"""Offline installer tests: fake GitHub transport, real checksum and file operations."""

import hashlib
import os
from pathlib import Path
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "https://github.com/sraodev/SmartPod"
PAYLOAD = b"#!/bin/sh\nprintf 'SmartPod CLI fixture\\n'\n"


def fake_tool(tool, args):
    if tool == "uname":
        print(os.environ["TEST_KERNEL" if args[0] == "-s" else "TEST_ARCH"])
        return 0
    if tool in ("mv", "sha256sum"):
        return 1

    # Tests reject any transport destination outside this repository.
    url = args[-1]
    if not url.startswith(REPOSITORY + "/releases/"):
        return 90
    assert args[args.index("--proto") + 1] == "=https"
    assert args[args.index("--proto-redir") + 1] == "=https"
    with open(os.environ["TEST_URL_LOG"], "a") as log:
        log.write(url + "\n")
    mode = os.environ.get("TEST_MODE", "success")
    version = os.environ.get("SMARTPOD_VERSION") or "v1.2.3"
    if url.endswith("/latest"):
        if mode == "missing-release":
            return 22
        print(REPOSITORY + ("/releases" if mode == "bad-redirect" else "/releases/tag/" + version), end="")
        return 0
    if mode == "interrupt":
        os.kill(os.getppid(), signal.SIGTERM)
        return 1

    kernel = "darwin" if os.environ["TEST_KERNEL"] == "Darwin" else "linux"
    arch = "amd64" if os.environ["TEST_ARCH"] in ("x86_64", "amd64") else "arm64"
    asset = f"smartpod_{version[1:]}_{kernel}_{arch}"
    destination = Path(args[args.index("--output") + 1])
    if url.endswith("/SHA256SUMS.txt"):
        if mode == "missing-manifest":
            return 22
        checksum = hashlib.sha256(PAYLOAD).hexdigest()
        if mode == "bad-checksum":
            checksum = "0" * 64
        if mode == "malformed-checksum":
            checksum = "not-a-checksum"
        if mode == "missing-entry":
            asset = "firmware.bin"
        entry = f"{checksum}  {asset}\n"
        if mode == "duplicate-entry":
            entry += entry
        if mode == "binary-marker":
            entry = f"{checksum.upper()} *{asset}\n"
        destination.write_text(entry)
    elif url == f"{REPOSITORY}/releases/download/{version}/{asset}":
        if mode == "missing-asset":
            return 22
        destination.write_bytes(b"" if mode == "empty-binary" else PAYLOAD)
    else:
        return 91
    return 0


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="smartpod-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin_dir = self.root / "tools"
        self.bin_dir.mkdir()
        self.install_dir = self.root / "install with spaces"
        self.scratch = self.root / "tmp"
        self.scratch.mkdir()
        self.urls = self.root / "urls.log"
        self.env = dict(os.environ)
        for key in ("SMARTPOD_VERSION", "SMARTPOD_INSTALL_DIR"):
            self.env.pop(key, None)
        self.env.update({
            "PATH": str(self.bin_dir) + os.pathsep + os.environ["PATH"],
            "HOME": str(self.root / "home"),
            "TMPDIR": str(self.scratch),
            "SMARTPOD_INSTALL_DIR": str(self.install_dir),
            "TEST_KERNEL": "Linux",
            "TEST_ARCH": "x86_64",
            "TEST_URL_LOG": str(self.urls),
            "TEST_MODE": "success",
        })
        for tool in ("curl", "uname"):
            self.make_tool(tool)

    def make_tool(self, name):
        path = self.bin_dir / name
        path.write_text("#!/bin/sh\nexec " + shlex.quote(sys.executable) + " " +
                        shlex.quote(str(Path(__file__).resolve())) + " --tool " + name + ' "$@"\n')
        path.chmod(0o755)

    def run_installer(self, *args):
        return subprocess.run(["/bin/sh", str(ROOT / "install.sh"), *args],
                              env=self.env, text=True, capture_output=True, timeout=15)

    def assert_clean(self):
        self.assertEqual(list(self.scratch.iterdir()), [])
        if self.install_dir.is_dir():
            self.assertEqual(list(self.install_dir.glob(".smartpod.*")), [])

    def seed_install(self):
        self.install_dir.mkdir(exist_ok=True)
        destination = self.install_dir / "smartpod"
        destination.write_bytes(b"previous installation")
        return destination

    def test_supported_platforms_and_architecture_aliases(self):
        for kernel, arch in (("Linux", "x86_64"), ("Linux", "amd64"),
                             ("Linux", "aarch64"), ("Darwin", "arm64"),
                             ("Darwin", "x86_64")):
            with self.subTest(kernel=kernel, arch=arch):
                self.env.update(TEST_KERNEL=kernel, TEST_ARCH=arch)
                result = self.run_installer()
                self.assertEqual(result.returncode, 0, result.stderr)
                binary = self.install_dir / "smartpod"
                self.assertEqual(binary.read_bytes(), PAYLOAD)
                self.assertEqual(binary.stat().st_mode & 0o777, 0o755)
                self.assertIn("No shell profile was modified", result.stdout)
                self.assert_clean()

    def test_pinned_prerelease_skips_latest_lookup(self):
        self.env["SMARTPOD_VERSION"] = "v2.0.0-rc.1"
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("/latest", self.urls.read_text())
        self.assertIn("/download/v2.0.0-rc.1/smartpod_2.0.0-rc.1_linux_amd64", self.urls.read_text())

    def test_default_user_directory(self):
        self.env.pop("SMARTPOD_INSTALL_DIR")
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((Path(self.env["HOME"]) / ".local/bin/smartpod").read_bytes(), PAYLOAD)

    def test_successful_upgrade(self):
        destination = self.seed_install()
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(destination.read_bytes(), PAYLOAD)
        self.assert_clean()

    def test_download_and_verification_failures_preserve_existing_install(self):
        destination = self.seed_install()
        for mode in ("missing-release", "bad-redirect", "missing-asset", "missing-manifest",
                     "bad-checksum", "malformed-checksum", "missing-entry", "duplicate-entry",
                     "empty-binary", "interrupt"):
            with self.subTest(mode=mode):
                self.env["TEST_MODE"] = mode
                result = self.run_installer()
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(destination.read_bytes(), b"previous installation")
                self.assert_clean()

    def test_atomic_replacement_failure_preserves_existing_install(self):
        destination = self.seed_install()
        self.make_tool("mv")
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(destination.read_bytes(), b"previous installation")
        self.assert_clean()

    def test_binary_marker_and_uppercase_checksum(self):
        self.env["TEST_MODE"] = "binary-marker"
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_shasum_fallback(self):
        self.env["PATH"] = str(self.bin_dir)
        for command in ("shasum", "awk", "grep", "tr", "mktemp", "rm", "rmdir",
                        "mkdir", "cp", "chmod", "mv"):
            executable = shutil.which(command)
            self.assertIsNotNone(executable, command)
            (self.bin_dir / command).symlink_to(executable)
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.install_dir / "smartpod").read_bytes(), PAYLOAD)

    def test_checksum_command_failure_preserves_install(self):
        destination = self.seed_install()
        self.make_tool("sha256sum")
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SHA-256 calculation failed", result.stderr)
        self.assertEqual(destination.read_bytes(), b"previous installation")
        self.assert_clean()

    def test_missing_tools_fail_before_network(self):
        self.env["PATH"] = str(self.bin_dir)
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("sha256sum or shasum is required", result.stderr)
        (self.bin_dir / "curl").unlink()
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("curl is required", result.stderr)
        self.assertFalse(self.urls.exists())

    def test_invalid_versions_do_not_download(self):
        for version in ("latest", "../../other", "v1.2.3/other", "v1.2.3\nother", "v1;echo bad"):
            with self.subTest(version=version):
                self.env["SMARTPOD_VERSION"] = version
                result = self.run_installer()
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.urls.exists())

    def test_unsupported_platform_does_not_download(self):
        for kernel, arch in (("Windows", "x86_64"), ("Linux", "armv7l")):
            with self.subTest(kernel=kernel, arch=arch):
                self.env.update(TEST_KERNEL=kernel, TEST_ARCH=arch)
                result = self.run_installer()
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.urls.exists())

    def test_rejects_relative_install_directory(self):
        self.env["SMARTPOD_INSTALL_DIR"] = "relative/path"
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("absolute path", result.stderr)

    def test_refuses_symlink_destination(self):
        self.install_dir.mkdir()
        target = self.root / "unrelated"
        target.write_text("keep me")
        (self.install_dir / "smartpod").symlink_to(target)
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(target.read_text(), "keep me")
        self.assertIn("symbolic-link", result.stderr)

    def test_refuses_directory_destination(self):
        (self.install_dir / "smartpod").mkdir(parents=True)
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not a regular file", result.stderr)

    def test_help_has_no_side_effects(self):
        result = self.run_installer("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("SMARTPOD_VERSION", result.stdout)
        self.assertFalse(self.urls.exists())
        self.assertFalse(self.install_dir.exists())

    def test_unknown_arguments_fail_without_network(self):
        result = self.run_installer("--unknown")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.urls.exists())


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--tool":
        sys.exit(fake_tool(sys.argv[2], sys.argv[3:]))
    unittest.main()
