#!/bin/sh
# SmartPod CLI releases and this installer are hosted entirely on GitHub.
set -eu

fail() {
  printf 'SmartPod installer: %s\n' "$*" >&2
  exit 1
}

if [ "$#" -gt 0 ]; then
  if [ "$#" -eq 1 ] && [ "$1" = '--help' ]; then
    printf '%s\n' \
      'Install the SmartPod CLI from sraodev/SmartPod GitHub Releases.' \
      'SMARTPOD_VERSION=vX.Y.Z     Optional exact release tag (default: latest stable).' \
      'SMARTPOD_INSTALL_DIR=PATH   Destination (default: ~/.local/bin).' \
      'Requires curl and sha256sum or shasum. Does not install firmware.' \
      'CLI release assets must exist; the legacy firmware preview is not a CLI release.'
    exit 0
  fi
  fail 'Unknown arguments. Run with --help for usage.'
fi

command -v curl >/dev/null 2>&1 || fail 'curl is required.'
if command -v sha256sum >/dev/null 2>&1; then
  checksum_tool=sha256sum
elif command -v shasum >/dev/null 2>&1; then
  checksum_tool=shasum
else
  fail 'sha256sum or shasum is required.'
fi

case "$(uname -s)" in
  Darwin) operating_system=darwin ;;
  Linux) operating_system=linux ;;
  *) fail 'Supported operating systems: macOS and Linux.' ;;
esac
case "$(uname -m)" in
  x86_64|amd64) architecture=amd64 ;;
  arm64|aarch64) architecture=arm64 ;;
  *) fail 'Supported CPU architectures: amd64 and arm64 (64-bit only).' ;;
esac

repository_url=https://github.com/sraodev/SmartPod
version=${SMARTPOD_VERSION:-}
if [ -z "$version" ]; then
  latest_url=$(curl --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --fail --silent --show-error --location --connect-timeout 10 --max-time 120 --retry 2 \
    --output /dev/null --write-out '%{url_effective}' "$repository_url/releases/latest") ||
    fail 'No stable CLI release could be resolved on GitHub. CLI binaries may not be published yet. See https://github.com/sraodev/SmartPod/releases or set SMARTPOD_VERSION to a published CLI tag.'
  case "$latest_url" in
    "$repository_url/releases/tag/"*) version=${latest_url##*/} ;;
    *) fail 'GitHub did not return a release tag. No installation was changed.' ;;
  esac
fi
case "$version" in
  *[!0-9A-Za-z.-]*) fail 'Invalid characters in SMARTPOD_VERSION.' ;;
esac
printf '%s\n' "$version" | LC_ALL=C grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$' ||
  fail 'Invalid SMARTPOD_VERSION: expected vX.Y.Z or vX.Y.Z-prerelease.'

install_dir=${SMARTPOD_INSTALL_DIR:-${HOME:?Set HOME or SMARTPOD_INSTALL_DIR}/.local/bin}
case "$install_dir" in
  /*) ;;
  *) fail 'SMARTPOD_INSTALL_DIR must be an absolute path.' ;;
esac
destination=$install_dir/smartpod
check_destination() {
  [ ! -L "$destination" ] || fail 'Refusing to replace a symbolic-link destination.'
  if [ -e "$destination" ] && [ ! -f "$destination" ]; then
    fail 'The destination exists and is not a regular file.'
  fi
}
check_destination

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/smartpod-install.XXXXXX") || fail 'Could not create a temporary directory.'
staged_binary=
cleanup() {
  if [ -n "$staged_binary" ]; then
    rm -f -- "$staged_binary"
  fi
  rm -f -- "$work_dir/binary" "$work_dir/SHA256SUMS.txt"
  rmdir "$work_dir"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

asset=smartpod_${version#v}_${operating_system}_${architecture}
release_url=$repository_url/releases/download/$version
download() {
  curl --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --fail --silent --show-error --location --connect-timeout 10 --max-time 120 --retry 2 \
    --output "$2" "$1"
}
download "$release_url/$asset" "$work_dir/binary" ||
  fail "Could not download $asset. This tag may contain firmware only, or no compatible CLI binary. Existing installation unchanged."
download "$release_url/SHA256SUMS.txt" "$work_dir/SHA256SUMS.txt" ||
  fail 'Could not download SHA256SUMS.txt. Existing installation unchanged.'
[ -s "$work_dir/binary" ] || fail 'The downloaded CLI binary is empty.'

expected_checksum=$(awk -v name="$asset" '
  $2 == name || $2 == "*" name {
    if (NF != 2) exit 1
    matches++
    checksum = $1
  }
  END { if (matches != 1) exit 1; print checksum }
' "$work_dir/SHA256SUMS.txt") || fail 'Expected exactly one matching SHA256SUMS.txt entry.'
printf '%s\n' "$expected_checksum" | LC_ALL=C grep -Eq '^[0-9A-Fa-f]{64}$' ||
  fail 'Invalid SHA-256 value in the release manifest.'
expected_checksum=$(printf '%s' "$expected_checksum" | tr '[:upper:]' '[:lower:]')
if [ "$checksum_tool" = sha256sum ]; then
  checksum_output=$(sha256sum "$work_dir/binary") || fail 'SHA-256 calculation failed.'
else
  checksum_output=$(shasum -a 256 "$work_dir/binary") || fail 'SHA-256 calculation failed.'
fi
actual_checksum=${checksum_output%% *}
[ "$actual_checksum" = "$expected_checksum" ] || fail 'SHA-256 mismatch. Existing installation unchanged.'

mkdir -p "$install_dir" || fail 'Could not create the install directory. Choose a user-owned SMARTPOD_INSTALL_DIR.'
staged_binary=$(mktemp "$install_dir/.smartpod.XXXXXX") || fail 'Could not stage the binary in the install directory.'
cp "$work_dir/binary" "$staged_binary"
chmod 755 "$staged_binary"
check_destination
# Staging in the destination directory makes replacement a same-filesystem rename.
mv -f "$staged_binary" "$destination"
staged_binary=

printf 'Installed SmartPod CLI %s to %s\n' "$version" "$destination"
case ":${PATH}:" in
  *":$install_dir:"*) ;;
  *) printf 'Add %s to PATH before running smartpod. No shell profile was modified.\n' "$install_dir" ;;
esac
