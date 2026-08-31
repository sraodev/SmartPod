import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("release", Path(__file__).resolve().parents[1] / "scripts/release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
COMMIT = "a" * 40
TAG = "v0.2.0-preview.1"


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="smartpod-release-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.package = self.root / "package"
        self.package.mkdir()
        for name in release.PAYLOAD:
            (self.package / name).write_bytes(b"fixture artifact\n")
        self.manifest = {
            "schema_version": 1, "source": {"repository": release.REPOSITORY, "commit": COMMIT, "tag": TAG},
            "preview": True, "limitations": release.LIMITATIONS,
            "artifacts": [{"name": name, "size": (self.package / name).stat().st_size,
                           "sha256": release.digest(self.package / name)} for name in sorted(release.PAYLOAD)],
        }
        self.save_manifest()

    def save_manifest(self):
        (self.package / "manifest.json").write_text(json.dumps(self.manifest))
        self.save_checksums()

    def save_checksums(self):
        (self.package / "SHA256SUMS.txt").write_text("".join(
            f"{release.digest(self.package / name)}  {name}\n"
            for name in sorted(release.PAYLOAD | {"manifest.json"})))

    def test_valid_download_matches_original_bytes(self):
        downloaded = self.root / "downloaded"
        shutil.copytree(self.package, downloaded)
        release.verify(downloaded, COMMIT, TAG)

    def test_sboms_preserve_versions_and_coverage_gaps(self):
        lock = {"lockfileVersion": 3, "name": "frontend", "version": "1.0.0", "packages": {
            "": {}, "node_modules/@scope/demo": {"version": "1.2.3", "integrity": "sha512-example", "dev": True},
            "node_modules/parent/node_modules/demo": {"version": "2.0.0", "optional": True},
        }}
        bom = release.frontend_bom(lock)
        self.assertEqual([c["name"] for c in bom["components"]], ["@scope/demo", "demo"])
        self.assertEqual([c["version"] for c in bom["components"]], ["1.2.3", "2.0.0"])
        self.assertEqual(bom, release.frontend_bom(lock))
        self.assertTrue(bom["metadata"]["properties"])
        firmware = release.firmware_bom([{"type": "tool", "name": "compiler", "version": "4.8.2", "spec": {"uri": "https://example.test/compiler#commit"}}], TAG)
        self.assertEqual(firmware["components"][0]["version"], "4.8.2")
        self.assertTrue(firmware["metadata"]["properties"])

    def test_unsupported_or_empty_lockfile_fails(self):
        for lock in [{}, {"lockfileVersion": 3, "packages": {"": {}}},
                     {"lockfileVersion": 3, "packages": {"node_modules/test": {"link": True}}}]:
            with self.assertRaises(ValueError):
                release.frontend_bom(lock)

    def test_tampering_same_size_fails_hash(self):
        (self.package / "firmware.bin").write_bytes(b"changed artifact\n")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            release.verify(self.package, COMMIT, TAG)

    def test_truncated_artifact_fails_size(self):
        (self.package / "spiffs.bin").write_bytes(b"short")
        with self.assertRaisesRegex(ValueError, "size mismatch"):
            release.verify(self.package, COMMIT, TAG)

    def test_manifest_tampering_fails_checksums(self):
        (self.package / "manifest.json").write_text(json.dumps(self.manifest) + " ")
        with self.assertRaisesRegex(ValueError, "Checksum manifest"):
            release.verify(self.package, COMMIT, TAG)

    def test_rejects_duplicate_artifacts_and_traversal(self):
        for name in ["../firmware.bin", "spiffs.bin"]:
            with self.subTest(name=name):
                self.manifest["artifacts"][0]["name"] = name
                self.save_manifest()
                with self.assertRaises(ValueError):
                    release.verify(self.package, COMMIT, TAG)

    def test_rejects_duplicate_json_keys(self):
        file = self.package / "manifest.json"
        file.write_text('{"schema_version":1,' + file.read_text()[1:])
        with self.assertRaisesRegex(ValueError, "Duplicate JSON"):
            release.verify(self.package, COMMIT, TAG)

    def test_rejects_missing_extra_and_symlink_files(self):
        path = self.package / "firmware.bin"
        path.unlink()
        with self.assertRaises(ValueError):
            release.verify(self.package, COMMIT, TAG)
        path.symlink_to(self.package / "spiffs.bin")
        with self.assertRaisesRegex(ValueError, "symlinks"):
            release.verify(self.package, COMMIT, TAG)
        path.unlink()
        path.write_bytes(b"fixture artifact\n")
        (self.package / "unexpected.bin").write_bytes(b"extra")
        with self.assertRaises(ValueError):
            release.verify(self.package, COMMIT, TAG)

    def test_rejects_wrong_commit_tag_and_removed_disclosures(self):
        for commit, tag in [("b" * 40, TAG), (COMMIT, "v0.2.0-preview.2")]:
            with self.assertRaises(ValueError):
                release.verify(self.package, commit, tag)
        self.manifest["limitations"] = []
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, "limitations"):
            release.verify(self.package, COMMIT, TAG)

    def test_rejects_duplicate_checksum_lines(self):
        path = self.package / "SHA256SUMS.txt"
        path.write_text(path.read_text() + path.read_text().splitlines()[0] + "\n")
        with self.assertRaisesRegex(ValueError, "Checksum manifest"):
            release.verify(self.package, COMMIT, TAG)

    def test_exact_tag_and_clean_source_required(self):
        with patch.object(release, "command", side_effect=[COMMIT, "", COMMIT, "123"]):
            self.assertEqual(release.source_identity(self.root, COMMIT, TAG)["tag"], TAG)
        for output in [["b" * 40], [COMMIT, " M src/main.cpp"], [COMMIT, "", "b" * 40]]:
            with patch.object(release, "command", side_effect=output), self.assertRaises(ValueError):
                release.source_identity(self.root, COMMIT, TAG)
        for tag in ["v0.2.0", "--help", "v0.2.0-preview.1\n"]:
            with patch.object(release, "command", side_effect=[COMMIT, ""]), self.assertRaises(ValueError):
                release.source_identity(self.root, COMMIT, tag)

    def test_existing_package_directory_not_overwritten(self):
        with patch.object(release, "source_identity"), patch.object(release, "firmware_inventory", return_value=([], "compiler")):
            with self.assertRaises(FileExistsError):
                release.assemble(self.root, self.package, COMMIT, TAG)
        release.verify(self.package, COMMIT, TAG)

    def test_existing_release_or_creation_failure_never_uploads(self):
        with patch.object(release, "source_identity"), patch.object(release, "command") as command:
            command.side_effect = ["", subprocess.CalledProcessError(1, "gh release create")]
            with self.assertRaises(subprocess.CalledProcessError):
                release.publish(self.root, self.package, COMMIT, TAG)
            self.assertEqual(command.call_count, 2)
            self.assertIn("create", command.call_args.args)

    def test_publish_only_after_downloaded_bytes_match(self):
        for tamper in [False, True]:
            with self.subTest(tamper=tamper):
                calls = []
                def fake_command(*args, **kwargs):
                    calls.append(args)
                    if args[:3] == ("gh", "release", "download"):
                        dest = Path(args[args.index("--dir") + 1])
                        shutil.copytree(self.package, dest, dirs_exist_ok=True)
                        if tamper:
                            (dest / "firmware.bin").write_bytes(b"changed artifact\n")
                    return ""
                with patch.object(release, "source_identity"), patch.object(release, "command", side_effect=fake_command):
                    if tamper:
                        with self.assertRaises(ValueError):
                            release.publish(self.root, self.package, COMMIT, TAG)
                    else:
                        release.publish(self.root, self.package, COMMIT, TAG)
                self.assertEqual(any(c[:3] == ("gh", "release", "edit") for c in calls), not tamper)
                self.assertFalse(any("--clobber" in c for c in calls))


if __name__ == "__main__":
    unittest.main()
