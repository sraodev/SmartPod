# Auditable firmware previews

This automation packages the legacy ESP8266 **firmware and device filesystem**, not
the gateway or future CLI. It does not certify hardware, validate physical flashing
or OTA, establish safe mains operation, or authorize real-money billing. Legacy
HTTP, public demo credentials/secrets, and non-expiring-token limitations remain.
See [SECURITY.md](../SECURITY.md) and the [preview notes](preview-release-notes.md).

## What ships

| File | Meaning |
| --- | --- |
| `firmware.bin`, `spiffs.bin` | Outputs from the exact checked-out source; filesystem includes the device dashboard |
| `manifest.json` | Full source commit, optional exact preview tag, source epoch, actual toolchain/runner versions, source-input hashes, artifact sizes and SHA-256 hashes, coverage gaps and limitations |
| `SHA256SUMS.txt` | Canonical SHA-256 entries for every payload file plus `manifest.json`; it does not hash itself |
| `firmware-inventory.json` | Installed packages resolved for the pinned PlatformIO `esp12e` environment, with versions and source specifications |
| `firmware.cdx.json` | CycloneDX 1.5 package-level firmware/build-tool inventory |
| `frontend.cdx.json` | CycloneDX 1.5 inventory from every `package-lock.json` package entry, including build/dev/optional dependencies and their recorded integrity/source metadata |

The manifest deliberately records `byte_identical_rebuild_verified: false`.
Dependency inventories are not a security audit or proof of what code is reachable
in a binary. Framework-bundled SDKs/blobs, system libraries, file-level licenses,
and PlatformIO Core's transitive Python/build-helper dependencies are not expanded.
Firmware dependency edges are not claimed. The npm lockfile contains packages that
may not appear in the emitted browser bundle. Local source patches such as
`timelib_fix.py` are identified by the source commit, not separate component hashes.
Neither SBOM asserts that these legacy dependencies are free of vulnerabilities.
The existing lockfile also has an optional peer mismatch: native `npm sbom` rejects
`yaml@1.10.3` against `postcss-load-config@6.0.1`'s `^2.4.2` peer. The explicit
lockfile inventory retains these versions without claiming peer compatibility or
silently changing frontend dependencies. Repair belongs to frontend maintenance.

## Automation and publication boundary

The required CI job builds the firmware/filesystem, assembles a **candidate** package,
uploads it as `preview-package-ci`, downloads it again, and verifies its exact bytes.
PR candidate manifests identify the tested merge commit and have `tag: null`.
PR jobs cannot publish releases or create attestations.

[Preview release verification](../.github/workflows/preview-release.yml) has two modes:

- **Dry run:** a manual dispatch (including on an existing tag containing this workflow), or a relevant
  workflow/script/doc change pushed to `master`, builds, attests, uploads, downloads,
  and verifies the package. It creates no release. A branch dry run is a candidate,
  not a tagged release. CI artifacts expire; they are not permanent release assets.
- **Publish:** pushing an explicitly chosen, existing-source `vX.Y.Z-preview.N` tag
  runs the same checks and then publishes a new prerelease. The tag must resolve to
  the checked-out commit and that commit must be an ancestor of `origin/master`.
  The workflow does not create tags. Review the tagged workflow/source before pushing.

Publication first creates a **new draft** using `gh release create --verify-tag`.
An existing release or draft causes failure. Assets upload without `--clobber`, are
downloaded into a fresh directory, and must match both the downloaded manifest and
the original local files before the draft becomes public. The release remains a
prerelease and is not marked latest. A partial upload or verification failure leaves
a draft for manual investigation; rerunning will not silently resume or overwrite it.

This no-overwrite behavior applies to the automation. Repository administrators
should also enable GitHub's [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
to prevent later asset/tag mutation outside the workflow. No repository setting or
existing release is silently changed here. The old `v0.1.0-preview.1` release is not
retroactively attested or repackaged.

## Provenance and independent verification

The workflow uses GitHub's supported [build provenance attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
with OIDC (`id-token: write` and `attestations: write` only in the trusted build job).
No long-lived signing key is created or committed. Every package file is attested;
the attested manifest also binds the payload hashes. Publication has a separate
contents-write job, which verifies provenance before creating a draft.

Select the tag and full commit from independently reviewed Git history, **not solely
from an unverified downloaded manifest**. Use a reviewed checkout's verifier script.
For a future release produced by this workflow:

```sh
TAG=vX.Y.Z-preview.N                 # replace with the reviewed existing tag
COMMIT=FULL_40_CHARACTER_COMMIT      # replace with its independently reviewed commit
DOWNLOAD_DIR=$(mktemp -d)
gh release download "$TAG" --repo sraodev/SmartPod --dir "$DOWNLOAD_DIR" --pattern '*'
gh attestation verify "$DOWNLOAD_DIR/manifest.json" \
  --repo sraodev/SmartPod \
  --signer-workflow sraodev/SmartPod/.github/workflows/preview-release.yml \
  --source-digest "$COMMIT" --source-ref "refs/tags/$TAG" \
  --deny-self-hosted-runners
python3 scripts/release.py verify "$DOWNLOAD_DIR" --commit "$COMMIT" --tag "$TAG"
```

Requires Python 3.11+ and a current authenticated GitHub CLI. You can independently
verify each binary with the same `gh attestation verify` flags instead of relying on
the manifest binding. For a branch dry run, use its reviewed full commit and
`--source-ref refs/heads/master`, download `preview-package` with `gh run download`,
and omit `--tag` from the Python verification command.

For an additional conventional checksum check, run `sha256sum -c SHA256SUMS.txt`
inside the downloaded directory (macOS: `shasum -a 256 -c SHA256SUMS.txt`). A checksum
alone detects corruption, not a compromised publisher who replaces both file and
checksum. Attestation verifies the workflow/source identity and bytes, not hardware
safety, code correctness, or independent reproducibility. GitHub's CLI also supports
[offline bundle verification](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline).

## Rebuild the exact source

Use a fresh Linux environment matching the verified manifest's OS/architecture,
Node/npm/Python versions and runner-image information. Install the recorded Node
and npm versions before the commands below; `node --version` and `npm --version`
must match the manifest. Release automation uses Ubuntu 24.04, Node 24, Python 3.12,
PlatformIO 6.1.19, and the framework/toolchain/library pins in `platformio.ini`.

From a trusted clone, with the reviewed `TAG` and `COMMIT` selected as above:

```sh
git fetch origin tag "$TAG"
REBUILD_DIR=$(mktemp -d)
git worktree add --detach "$REBUILD_DIR/source" "$COMMIT"
python3.12 -m venv "$REBUILD_DIR/venv"
. "$REBUILD_DIR/venv/bin/activate"
python -m pip install platformio==6.1.19
export PLATFORMIO_CORE_DIR="$REBUILD_DIR/platformio"
cd "$REBUILD_DIR/source"
export SOURCE_DATE_EPOCH=$(git show -s --format=%ct HEAD)
CI=true npm --prefix interface ci
CI=true npm --prefix interface run build
pio run -e esp12e
pio run -e esp12e -t buildfs
python scripts/release.py assemble dist-release --commit "$COMMIT" --tag "$TAG"
```

Compare rebuilt `firmware.bin` and `spiffs.bin` byte-for-byte with the independently
verified downloads (`cmp` or SHA-256). A successful compile, a second build in the
same cached directory, or a successful download check does **not** establish
independent byte-identical reproducibility. Paths, timestamps, runner/tool packages,
filesystem ordering, and legacy compiler behavior may change output. `SOURCE_DATE_EPOCH`
is supplied but not assumed to control every legacy tool. Recorded tool/platform
metadata and synthetic versions for unversioned VCS libraries can also differ. Record each
comparison and investigate differences; this automation makes no blanket reproducibility claim.

## Focused regression checks

```sh
python3 -m unittest discover -s tests -p 'test_release.py' -v
```

Tests cover same-size tampering, truncation, manifest/checksum mutation, duplicate
entries/JSON keys, unsafe or unexpected filenames, symlinks, wrong source identity,
removed disclosures, refusal to overwrite packages/releases, and refusing publication
when downloaded release bytes differ. Live workflow upload/download and attestation
checks complement these mocked publication tests; tests do not create a real release.
