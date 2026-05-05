#!/bin/sh
#
# install.test.sh — minimal plain-sh tests for install.sh helpers.
# For end-to-end coverage see the release-smoke CI workflow.

set -u

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
export CB_INSTALL_SH_LIB=1
# shellcheck source=SCRIPTDIR/install.sh
. "$script_dir/install.sh"

pass=0
fail=0

assert_eq() {
  if [ "$1" = "$2" ]; then
    pass=$((pass + 1))
    printf 'ok — %s\n' "$3"
  else
    fail=$((fail + 1))
    printf 'FAIL — %s\n  expected: %s\n  got:      %s\n' "$3" "$2" "$1"
  fi
}

assert_exits_nonzero() {
  if ( $1 ) >/dev/null 2>&1; then
    fail=$((fail + 1))
    printf 'FAIL — %s (expected non-zero exit)\n' "$2"
  else
    pass=$((pass + 1))
    printf 'ok — %s\n' "$2"
  fi
}

# --- detect_platform ---

# shellcheck disable=SC2317,SC2329  # uname redefinition called indirectly via assert_exits_nonzero $1 (SC2317 = shellcheck <0.10, SC2329 = >=0.10)
uname() { case "$1" in -s) echo Darwin ;; -m) echo arm64 ;; esac; }
assert_eq "$(detect_platform)" "darwin arm64" "darwin arm64"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo Darwin ;; -m) echo x86_64 ;; esac; }
assert_eq "$(detect_platform)" "darwin amd64" "darwin x86_64 maps to amd64"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo Linux ;; -m) echo x86_64 ;; esac; }
assert_eq "$(detect_platform)" "linux amd64" "linux x86_64 maps to amd64"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo Linux ;; -m) echo aarch64 ;; esac; }
assert_eq "$(detect_platform)" "linux arm64" "linux aarch64 maps to arm64"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo Linux ;; -m) echo i386 ;; esac; }
assert_exits_nonzero detect_platform "unsupported arch fails"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo FreeBSD ;; -m) echo amd64 ;; esac; }
assert_exits_nonzero detect_platform "unsupported OS fails"

unset -f uname

# --- cask_for_channel ---

assert_eq "$(cask_for_channel stable)" "contextbridge/tap/cli" "stable channel maps to cli cask"
assert_eq "$(cask_for_channel alpha)" "contextbridge/tap/cli@alpha" "alpha channel maps to cli@alpha cask"
assert_exits_nonzero 'cask_for_channel bogus' "unknown channel rejected"

# --- slug_for_channel ---

assert_eq "$(slug_for_channel stable)" "latest" "stable channel maps to latest slug"
assert_eq "$(slug_for_channel alpha)" "latest-alpha" "alpha channel maps to latest-alpha slug"
assert_exits_nonzero 'slug_for_channel bogus' "unknown channel rejected"

# --- verify_checksum ---

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

printf 'hello\n' > "$tmp/sample.tar.gz"
expected=$(shasum -a 256 "$tmp/sample.tar.gz" 2>/dev/null | awk '{print $1}')
if [ -z "$expected" ]; then expected=$(sha256sum "$tmp/sample.tar.gz" | awk '{print $1}'); fi
printf '%s  sample.tar.gz\nabc  other.tar.gz\n' "$expected" > "$tmp/checksums.txt"

if verify_checksum "$tmp/sample.tar.gz" "sample.tar.gz" "$tmp/checksums.txt" >/dev/null 2>&1; then
  pass=$((pass + 1)); printf 'ok — verify_checksum accepts correct hash\n'
else
  fail=$((fail + 1)); printf 'FAIL — verify_checksum rejected correct hash\n'
fi

printf 'deadbeef  sample.tar.gz\n' > "$tmp/bad.txt"
if ( verify_checksum "$tmp/sample.tar.gz" "sample.tar.gz" "$tmp/bad.txt" ) >/dev/null 2>&1; then
  fail=$((fail + 1)); printf 'FAIL — verify_checksum accepted wrong hash\n'
else
  pass=$((pass + 1)); printf 'ok — verify_checksum rejects wrong hash\n'
fi

# --- run_configure ---

fake_bin_dir="$tmp/fake-bin"
fake_configure_log="$tmp/configure.log"
mkdir -p "$fake_bin_dir"
# shellcheck disable=SC2016  # literal fake-script body; it expands when the fake binary runs
printf '%s\n' '#!/bin/sh' 'printf "%s\n" "$*" >> "$FAKE_CONFIGURE_LOG"' > "$fake_bin_dir/$BINARY_NAME"
chmod +x "$fake_bin_dir/$BINARY_NAME"

export FAKE_CONFIGURE_LOG="$fake_configure_log"
CB_SKIP_CONFIGURE=0
CB_INSTALL_DIR="$fake_bin_dir"
_install_method=tarball

configure_output=$(run_configure </dev/null)
if [ -e "$fake_configure_log" ]; then
  fail=$((fail + 1)); printf 'FAIL — run_configure invoked prompts when stdin was non-interactive\n'
else
  pass=$((pass + 1)); printf 'ok — run_configure skips prompts when stdin is non-interactive\n'
fi

case "$configure_output" in
  *"stdin is not an interactive terminal"*"contextbridge install"*)
    pass=$((pass + 1)); printf 'ok — run_configure tells users how to configure manually\n'
    ;;
  *)
    fail=$((fail + 1)); printf 'FAIL — run_configure non-interactive message was incomplete\n%s\n' "$configure_output"
    ;;
esac

# --- summary ---

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
