# GitHub-only SmartPod CLI installation

Status: **installer implemented; CLI release binaries not yet published**. The legacy `v0.1.0-preview.1` firmware release is not a CLI release. The installer will fail without changing an existing installation if no suitable release or asset exists.

CLI implementation is tracked in [#14](https://github.com/sraodev/SmartPod/issues/14), banner work in [#15](https://github.com/sraodev/SmartPod/issues/15), release verification in [#21](https://github.com/sraodev/SmartPod/issues/21), and installer work in [#23](https://github.com/sraodev/SmartPod/issues/23).

## Install after the first CLI release

The script is stored in this repository. All binaries and checksums are stored in this repository's GitHub Releases. No Cloudflare, R2, custom CDN, API key, or installer service is needed.

```sh
curl --proto '=https' --tlsv1.2 -fsSL https://raw.githubusercontent.com/sraodev/SmartPod/master/install.sh | sh
```

For inspection before execution, download the script, read it, and then run it:

```sh
curl --proto '=https' --tlsv1.2 -fsSL \
  https://raw.githubusercontent.com/sraodev/SmartPod/master/install.sh \
  -o smartpod-install.sh
less smartpod-install.sh
sh smartpod-install.sh
```

Requirements: POSIX shell, curl, standard Unix file utilities, and either `sha256sum` or `shasum`. Target platforms are Linux/macOS on amd64/arm64; 32-bit Raspberry Pi OS and Windows are not supported by this script. Platform fixture tests are not proof that unreleased binaries run on physical targets.

The default destination is `$HOME/.local/bin/smartpod`. The installer does not use sudo, edit shell profiles, start a daemon, execute the downloaded binary, flash firmware, or control hardware. If necessary, add the chosen directory to PATH yourself.

## Version and destination options

Examples below use an illustrative release tag. Substitute a tag with actual CLI assets:

```sh
curl --proto '=https' --tlsv1.2 -fsSL \
  https://raw.githubusercontent.com/sraodev/SmartPod/master/install.sh | \
  SMARTPOD_VERSION=v0.2.0 SMARTPOD_INSTALL_DIR="$HOME/.local/bin" sh
```

- `SMARTPOD_VERSION`: exact tag such as `v0.2.0` or `v0.2.0-rc.1`; otherwise resolve GitHub's latest stable release. Prereleases need explicit selection.
- `SMARTPOD_INSTALL_DIR`: absolute user-owned destination directory; paths containing spaces are supported.
- `sh install.sh --help`: display usage without downloading or installing anything.

Pinning the binary tag does not pin the installer fetched from `master`. For an immutable installer source, replace `master` in the raw URL with a reviewed full commit SHA that contains `install.sh`, and select the release tag explicitly. Release tags/assets must not be overwritten. A checksum fetched from the same release detects corruption/mismatched bytes, **not a compromised publisher**. The [firmware preview provenance workflow](releases.md) now documents independent verification; extending it to future CLI assets remains part of CLI release delivery, not a capability of this installer.

## Release asset contract

Use single, uncompressed executable files. For the illustrative tag `v0.2.0`, upload:

```text
smartpod_0.2.0_linux_amd64
smartpod_0.2.0_linux_arm64
smartpod_0.2.0_darwin_amd64
smartpod_0.2.0_darwin_arm64
SHA256SUMS.txt
```

The version in the filename is the tag without its leading `v`, including any prerelease suffix. These filenames are a contract for future releases, not existing artifacts. Each binary must be built and smoke-tested for its target before claiming that target is supported; cross-compilation alone is insufficient.

`SHA256SUMS.txt` must have exactly one standard SHA-256 entry for each published binary, using its bare filename. Both text (`<hash>  <filename>`) and binary-marker (`<hash> *<filename>`) formats are accepted. Other release entries such as firmware are ignored. Generate the manifest from the actual output files, not by hand:

```sh
sha256sum smartpod_0.2.0_linux_amd64 smartpod_0.2.0_linux_arm64 \
  smartpod_0.2.0_darwin_amd64 smartpod_0.2.0_darwin_arm64 > SHA256SUMS.txt
```

Publish all assets and their manifest together, then verify the download-install-version lifecycle on each declared target. Do not relabel the existing `firmware.bin` as a CLI. A firmware-only latest release will fail safely; select a valid CLI tag explicitly if a later firmware release becomes GitHub's latest stable release.

## Failure and update behavior

Downloads use HTTPS-only redirects, bounded timeouts, and SHA-256 verification before installation. Unsupported platforms, malformed tags, missing/empty assets, absent/duplicate manifest entries, and checksum mismatches stop the installer. No unverified binary is made executable.

After verification, a temporary file is created inside the destination directory, made executable, and renamed over `smartpod`. This same-filesystem replacement preserves the previous binary if downloading, verification, or staging fails. Existing symlink or directory destinations are rejected. Catchable interruptions clean up temporary files; SIGKILL or power loss may leave temporary files for manual inspection. No automatic rollback copy or uninstaller is added.

## Verification

```sh
sh -n install.sh
shellcheck install.sh
python3 -m unittest discover -s tests -p 'test_install.py' -v
```

The standard-library tests mock only the transport/platform commands and use real hashing and filesystem operations in temporary directories. They cover target selection, pinned versions, successful upgrades, malformed versions, unavailable releases/assets, manifest/checksum failures, interruption, failed replacement, and destination safety. Tests make no network requests, run no downloaded executable, and do not need a published release.
