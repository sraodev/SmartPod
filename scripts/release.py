#!/usr/bin/env python3
"""Package and verify SmartPod preview bytes; no signing keys or hardware actions."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile

REPOSITORY = "sraodev/SmartPod"
PAYLOAD = {"firmware.bin", "spiffs.bin", "firmware.cdx.json", "frontend.cdx.json", "firmware-inventory.json"}
FILES = PAYLOAD | {"manifest.json", "SHA256SUMS.txt"}
PREVIEW_TAG = re.compile(r"v[0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+")
GAPS = [
    "Firmware inventory is package-level: framework-bundled SDKs, binary blobs, system libraries, and file-level license/reachability analysis are not expanded.",
    "Frontend SBOM describes the npm lockfile including build/dev/optional dependencies, not only code included in the browser bundle.",
    "Package metadata is not a vulnerability scan or a complete dependency graph; source patches such as timelib_fix.py are identified by the source commit.",
    "Gateway and future CLI binaries are not included in this firmware/filesystem preview.",
    "Host OS packages and PlatformIO Core's own transitive Python/build-helper dependencies are not enumerated.",
    "Frontend inventory does not validate peer compatibility. Native npm SBOM currently rejects yaml 1.10.3 against the optional ^2.4.2 peer of postcss-load-config 6.0.1; dependency repair is separate work.",
]
LIMITATIONS = [
    "Preview only; not a certified EVSE, safety controller, or revenue-grade meter.",
    "Legacy HTTP, public demo credentials/secrets, and non-expiring-token limitations remain; use an isolated lab, not a production network.",
    "No hardware qualification, physical flash/OTA validation, mains switching, or real-money billing is established by this build.",
    "Successful compilation and matching downloaded hashes do not prove independent byte-identical reproducibility.",
]


def command(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, data):
    with path.open("x", encoding="utf8") as stream:
        json.dump(data, stream, sort_keys=True, indent=2)
        stream.write("\n")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def load_json(path):
    return json.loads(path.read_text(encoding="utf8"), object_pairs_hook=unique_object)


def source_identity(root, expected_commit, tag):
    commit = command("git", "rev-parse", "HEAD", cwd=root)
    if not re.fullmatch(r"[0-9a-f]{40}", expected_commit) or commit != expected_commit:
        raise ValueError("Checkout does not match expected full source commit")
    if command("git", "status", "--porcelain", cwd=root):
        raise ValueError("Release packaging requires a clean source checkout")
    if tag:
        if not PREVIEW_TAG.fullmatch(tag):
            raise ValueError("Only vX.Y.Z-preview.N tags may be published")
        if command("git", "rev-parse", f"refs/tags/{tag}^{{commit}}", cwd=root) != commit:
            raise ValueError("Tag does not point to the checked-out commit")
    return {"repository": REPOSITORY, "commit": commit, "tag": tag,
            "epoch": int(command("git", "show", "-s", "--format=%ct", "HEAD", cwd=root))}


def firmware_inventory():
    # PlatformIO's pinned API resolves the environment, unlike scanning global caches.
    import platformio
    from platformio.platform.factory import PlatformFactory
    from platformio.package.manager.library import LibraryPackageManager
    from platformio.package.manager.platform import PlatformPackageManager
    if platformio.__version__ != "6.1.19":
        raise ValueError("Inventory collector requires PlatformIO 6.1.19")
    env = PlatformFactory.from_env("esp12e")
    packages = [PlatformPackageManager().get_package(env.get_dir())]
    for name in env.packages:
        package = env.pm.get_package(env.get_package_spec(name))
        if package:
            packages.append(package)
    libraries = LibraryPackageManager(str(Path(env.config.get("platformio", "libdeps_dir")) / "esp12e"))
    packages.extend(libraries.get_installed())
    inventory = sorted([p.metadata.as_dict() for p in packages], key=lambda p: (p["type"], p["name"], p["version"]))
    names = {p["name"] for p in inventory}
    if not {"toolchain-xtensa", "framework-arduinoespressif8266", "tool-mkspiffs", "ArduinoJson", "Time"} <= names:
        raise ValueError("Incomplete installed firmware dependency inventory")
    compiler = Path(env.get_package_dir("toolchain-xtensa")) / "bin/xtensa-lx106-elf-g++"
    return inventory, command(str(compiler), "--version").splitlines()[0]


def firmware_bom(inventory, version):
    return {
        "bomFormat": "CycloneDX", "specVersion": "1.5", "version": 1,
        "metadata": {"component": {"type": "application", "name": "SmartPod firmware", "version": version},
                     "properties": [{"name": "smartpod:coverage-gap", "value": gap} for gap in GAPS]},
        "components": [{
            "type": "application" if p["type"] == "tool" else "library",
            "bom-ref": f"platformio:{p['type']}/{p['name']}@{p['version']}",
            "name": p["name"], "version": p["version"],
            "properties": [{"name": "platformio:resolved-spec", "value": json.dumps(p["spec"], sort_keys=True)}],
        } for p in inventory],
    }


def frontend_bom(lock):
    if lock.get("lockfileVersion") != 3 or not lock.get("packages"):
        raise ValueError("Frontend inventory requires package-lock v3")
    components = []
    for location, package in sorted(lock["packages"].items()):
        if not location:
            continue
        if "node_modules/" not in location or not isinstance(package.get("version"), str):
            raise ValueError("Unsupported lockfile package entry")
        components.append({
            "type": "library", "bom-ref": f"npm-lock:{location}",
            "name": package.get("name") or location.rsplit("node_modules/", 1)[1],
            "version": package["version"],
            "properties": [{"name": f"npm:{key}", "value": json.dumps(package[key], sort_keys=True)}
                           for key in ("resolved", "integrity", "license", "dev", "optional") if key in package],
        })
    if not components:
        raise ValueError("Empty frontend inventory")
    return {"bomFormat": "CycloneDX", "specVersion": "1.5", "version": 1,
            "metadata": {"component": {"type": "application", "name": lock["name"], "version": lock["version"]},
                         "properties": [{"name": "smartpod:coverage-gap", "value": gap} for gap in GAPS]},
            "components": components}


def assemble(root, out, expected_commit, tag):
    source = source_identity(root, expected_commit, tag)
    inventory, compiler = firmware_inventory()
    out.mkdir()  # Never reuse a partial or existing package directory.
    for name in ("firmware.bin", "spiffs.bin"):
        src = root / ".pio/build/esp12e" / name
        if not src.is_file() or src.stat().st_size == 0:
            raise ValueError(f"Missing built artifact: {name}")
        shutil.copyfile(src, out / name)
    write_json(out / "firmware-inventory.json", inventory)
    write_json(out / "firmware.cdx.json", firmware_bom(inventory, tag or expected_commit))
    frontend = frontend_bom(load_json(root / "interface/package-lock.json"))
    write_json(out / "frontend.cdx.json", frontend)
    manifest = {
        "schema_version": 1, "source": source, "preview": True,
        "toolchain": {"platformio": "6.1.19", "python": platform.python_version(),
                      "node": command("node", "--version"), "npm": command("npm", "--version"),
                      "compiler": compiler, "os": platform.system(), "machine": platform.machine(),
                      "runner_image": os.environ.get("ImageOS"), "runner_image_version": os.environ.get("ImageVersion")},
        "inputs": {name: digest(root / name) for name in ("platformio.ini", "interface/package-lock.json", "timelib_fix.py")},
        "artifacts": [{"name": name, "size": (out / name).stat().st_size, "sha256": digest(out / name)} for name in sorted(PAYLOAD)],
        "coverage_gaps": GAPS, "limitations": LIMITATIONS,
        "byte_identical_rebuild_verified": False,
    }
    write_json(out / "manifest.json", manifest)
    with (out / "SHA256SUMS.txt").open("x", encoding="ascii") as stream:
        for name in sorted(PAYLOAD | {"manifest.json"}):
            stream.write(f"{digest(out / name)}  {name}\n")
    verify(out, expected_commit, tag)


def verify(directory, expected_commit, tag=None):
    if {p.name for p in directory.iterdir()} != FILES:
        raise ValueError("Unexpected or missing release files")
    if any(p.is_symlink() or not p.is_file() for p in directory.iterdir()):
        raise ValueError("Release files must be regular files, not symlinks")
    manifest = load_json(directory / "manifest.json")
    if manifest["schema_version"] != 1 or manifest["source"]["repository"] != REPOSITORY:
        raise ValueError("Unsupported release manifest")
    if not re.fullmatch(r"[0-9a-f]{40}", expected_commit) or manifest["source"]["commit"] != expected_commit:
        raise ValueError("Source commit mismatch")
    if tag is not None and manifest["source"]["tag"] != tag:
        raise ValueError("Source tag mismatch")
    if manifest["preview"] is not True or manifest["limitations"] != LIMITATIONS:
        raise ValueError("Missing preview limitations")
    entries = manifest["artifacts"]
    if len(entries) != len(PAYLOAD) or {e["name"] for e in entries} != PAYLOAD:
        raise ValueError("Duplicate or unexpected artifact entries")
    for entry in entries:
        path = directory / entry["name"]
        if type(entry["size"]) is not int or entry["size"] <= 0 or path.stat().st_size != entry["size"]:
            raise ValueError(f"Artifact size mismatch: {entry['name']}")
        if digest(path) != entry["sha256"]:
            raise ValueError(f"SHA-256 mismatch: {entry['name']}")
    checksums = (directory / "SHA256SUMS.txt").read_text(encoding="ascii").splitlines()
    expected = [f"{digest(directory / name)}  {name}" for name in sorted(PAYLOAD | {"manifest.json"})]
    if checksums != expected:
        raise ValueError("Checksum manifest mismatch")
    return manifest


def verify_remote_tag(root, expected_commit, tag):
    ref = f"refs/tags/{tag}"
    output = command("git", "ls-remote", "--exit-code", "origin", ref, ref + "^{}", cwd=root)
    refs = {name: sha for sha, name in (line.split() for line in output.splitlines())}
    if refs.get(ref + "^{}", refs.get(ref)) != expected_commit:
        raise ValueError("Remote tag moved or does not match the built commit")


def publish(root, directory, expected_commit, tag):
    if not tag:
        raise ValueError("Publication requires an existing preview tag")
    source_identity(root, expected_commit, tag)
    verify(directory, expected_commit, tag)
    command("git", "merge-base", "--is-ancestor", expected_commit, "origin/master", cwd=root)
    verify_remote_tag(root, expected_commit, tag)
    # Creation is the no-overwrite guard: an existing release (including draft)
    # makes gh fail. Never resume one implicitly and never use upload --clobber.
    command("gh", "release", "create", tag, "--repo", REPOSITORY, "--verify-tag", "--draft", "--prerelease",
            "--latest=false", "--title", f"SmartPod {tag} — unqualified firmware preview",
            "--notes-file", str(root / "docs/preview-release-notes.md"))
    command("gh", "release", "upload", tag, "--repo", REPOSITORY, *[str(directory / name) for name in sorted(FILES)])
    with tempfile.TemporaryDirectory(prefix="smartpod-release-download-") as temp:
        downloaded = Path(temp)
        command("gh", "release", "download", tag, "--repo", REPOSITORY, "--dir", temp, "--pattern", "*")
        verify(downloaded, expected_commit, tag)
        if any(digest(downloaded / name) != digest(directory / name) for name in FILES):
            raise ValueError("Uploaded release bytes differ; leaving draft unpublished")
    verify_remote_tag(root, expected_commit, tag)
    command("gh", "release", "edit", tag, "--repo", REPOSITORY, "--draft=false", "--prerelease", "--latest=false")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("assemble", "verify", "publish"))
    parser.add_argument("directory", type=Path)
    parser.add_argument("--commit", required=True, help="Independently selected full source commit")
    parser.add_argument("--tag", help="Exact existing vX.Y.Z-preview.N tag")
    args = parser.parse_args()
    args.tag = args.tag or None
    root = Path(__file__).resolve().parents[1]
    if args.action == "verify":
        verify(args.directory, args.commit, args.tag)
    else:
        os.chdir(root)
        globals()[args.action](root, args.directory.resolve(), args.commit, args.tag)
    print(f"SmartPod release {args.action}: verified")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(f"SmartPod release failed: {error}")
