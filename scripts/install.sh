#!/bin/sh
#
# install.sh — ContextBridge CLI installer
#
# Source Code:
#   https://github.com/contextbridge/planbridge
#
# Usage:
#   /bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)"
#   /bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)" -- --channel alpha
#   /bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)" -- --version v0.1.0 --no-brew
#
# By default, if Homebrew is available, this script installs via:
#   brew install --cask contextbridge/tap/cli[@alpha]
# Otherwise it downloads the release tarball into --bin-dir.
# After install, it runs `contextbridge install` interactively to configure
# detected AI coding harnesses. The documented /bin/sh -c "$(curl ...)" form
# preserves terminal stdin for prompts. Skip with --no-configure /
# CB_SKIP_CONFIGURE=1.
#
# Privacy: PlanBridge runs locally. Your plan content stays on your machine,
# with no remote backend, account, or API keys. It sends anonymous product
# analytics and crash reports only; turn that off with DO_NOT_TRACK=1 or
# CONTEXTBRIDGE_TELEMETRY_DISABLED=1. See https://plan.contextbridge.ai/privacy/.
#
# To verify the binary: macOS release builds are signed and Apple-notarized, and
# every release archive carries GitHub build provenance. Check it with
# `gh attestation verify` (the README's "Verify what you're running" section has
# the command).
#
# Env vars (CLI flags take precedence):
#   CB_CHANNEL          stable (default) | alpha
#   CB_VERSION          pin to a tag (e.g. v0.1.0); requires --no-brew if brew is available
#   CB_INSTALL_DIR      tarball target dir (default: $HOME/.local/bin); requires --no-brew if brew is available
#   CB_NO_BREW=1        skip the Homebrew install path even if `brew` is available
#   CB_SKIP_CONFIGURE=1 skip the post-install `contextbridge install` step

set -eu

DOWNLOAD_BASE="https://downloads.contextbridge.ai/cli"
DEFAULT_INSTALL_DIR="${HOME}/.local/bin"
BINARY_NAME="contextbridge"

main() {
  parse_args "$@"

  _install_method=tarball
  if [ "$CB_NO_BREW" != "1" ] && check_brew_available; then
    if [ "$_brew_incompatible_flags" = "1" ]; then
      fail_brew_incompat
    fi
    install_via_brew
    _install_method=brew
  fi

  if [ "$_install_method" = "tarball" ]; then
    _platform=$(detect_platform)
    OS="${_platform% *}"
    ARCH="${_platform#* }"
    info "detected platform: ${OS}/${ARCH}"

    if [ -n "$CB_VERSION" ]; then
      case "$CB_VERSION" in v*) ;; *) CB_VERSION="v$CB_VERSION" ;; esac
      info "resolved version: $CB_VERSION"
    fi

    install_binary
  fi

  run_configure
  print_done
}

parse_args() {
  CB_CHANNEL="${CB_CHANNEL:-stable}"
  CB_NO_BREW="${CB_NO_BREW:-0}"
  CB_SKIP_CONFIGURE="${CB_SKIP_CONFIGURE:-0}"

  # Track whether any brew-incompatible knob was explicitly set, before defaults
  # collapse "unset" and "set to default value" into one.
  _brew_incompatible_flags=0
  [ -n "${CB_VERSION:-}" ] && _brew_incompatible_flags=1
  [ -n "${CB_INSTALL_DIR:-}" ] && _brew_incompatible_flags=1

  CB_VERSION="${CB_VERSION:-}"
  CB_INSTALL_DIR="${CB_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

  while [ $# -gt 0 ]; do
    case "$1" in
      --channel) CB_CHANNEL="${2:-}"; shift 2 ;;
      --channel=*) CB_CHANNEL="${1#*=}"; shift ;;
      --version) CB_VERSION="${2:-}"; _brew_incompatible_flags=1; shift 2 ;;
      --version=*) CB_VERSION="${1#*=}"; _brew_incompatible_flags=1; shift ;;
      --bin-dir) CB_INSTALL_DIR="${2:-}"; _brew_incompatible_flags=1; shift 2 ;;
      --bin-dir=*) CB_INSTALL_DIR="${1#*=}"; _brew_incompatible_flags=1; shift ;;
      --no-brew) CB_NO_BREW=1; shift ;;
      --no-configure) CB_SKIP_CONFIGURE=1; shift ;;
      -h|--help) print_help; exit 0 ;;
      *) fail "unknown argument: $1 (try --help)" ;;
    esac
  done

  case "$CB_CHANNEL" in
    stable|alpha) ;;
    *) fail "invalid --channel '$CB_CHANNEL' (expected 'stable' or 'alpha')" ;;
  esac
}

print_help() {
  cat <<EOF
contextbridge installer

Recommended one-line install:
  /bin/sh -c "\$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)"

Usage:
  install.sh [--channel stable|alpha] [--version vX.Y.Z] [--bin-dir PATH]
             [--no-brew] [--no-configure]

Install paths:
  By default, if Homebrew is available, this script installs via:
    brew install --cask contextbridge/tap/cli[@alpha]
  Otherwise it downloads a release tarball into --bin-dir.

  After install, this script runs 'contextbridge install' interactively to
  configure detected AI coding harnesses when stdin is a terminal. The
  documented /bin/sh -c "\$(curl ...)" form preserves terminal stdin for prompts.

Options:
  --channel        release channel: stable (default) or alpha
  --version        pin to a specific tag (e.g. v0.1.0); requires --no-brew if Homebrew is available
  --bin-dir        target directory for the tarball install (default: \$HOME/.local/bin); requires --no-brew if Homebrew is available
  --no-brew        skip the Homebrew install path even if 'brew' is available
  --no-configure   skip the post-install 'contextbridge install' step
  -h, --help       show this help

Environment variables (CLI flags take precedence):
  CB_CHANNEL, CB_VERSION, CB_INSTALL_DIR, CB_NO_BREW, CB_SKIP_CONFIGURE
EOF
}

detect_platform() {
  _os=""; _arch=""
  case "$(uname -s)" in
    Darwin) _os=darwin ;;
    Linux) _os=linux ;;
    *) fail "unsupported OS: $(uname -s). contextbridge supports macOS and Linux." ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) _arch=arm64 ;;
    x86_64|amd64) _arch=amd64 ;;
    *) fail "unsupported architecture: $(uname -m). contextbridge supports amd64 and arm64." ;;
  esac
  printf '%s %s\n' "$_os" "$_arch"
}

install_binary() {
  if [ -n "$CB_VERSION" ]; then
    _slug="${CB_VERSION#v}"
  else
    _slug=$(slug_for_channel "$CB_CHANNEL") \
      || fail "internal error: unknown channel '$CB_CHANNEL'"
  fi
  _asset="${BINARY_NAME}_${_slug}_${OS}_${ARCH}.tar.gz"
  _asset_url="${DOWNLOAD_BASE}/${_slug}/${_asset}"
  _checksums_url="${DOWNLOAD_BASE}/${_slug}/checksums.txt"

  _tmp=$(mktemp -d 2>/dev/null || mktemp -d -t cb-install)
  # shellcheck disable=SC2064
  trap "rm -rf '$_tmp'" EXIT INT TERM

  info "downloading ${_asset}..."
  http_download "$_asset_url" "$_tmp/$_asset" \
    || fail "download failed: $_asset_url"

  info "downloading checksums.txt..."
  http_download "$_checksums_url" "$_tmp/checksums.txt" \
    || fail "checksum file download failed: $_checksums_url"

  verify_checksum "$_tmp/$_asset" "$_asset" "$_tmp/checksums.txt"

  info "extracting..."
  tar -xzf "$_tmp/$_asset" -C "$_tmp" \
    || fail "tarball extraction failed"

  [ -f "$_tmp/$BINARY_NAME" ] \
    || fail "expected '$BINARY_NAME' in tarball, not found"

  info "installing to $CB_INSTALL_DIR..."
  mkdir -p "$CB_INSTALL_DIR" \
    || fail "could not create install dir: $CB_INSTALL_DIR"
  mv "$_tmp/$BINARY_NAME" "$CB_INSTALL_DIR/$BINARY_NAME" \
    || fail "could not write to $CB_INSTALL_DIR. Try a different --bin-dir."
  chmod +x "$CB_INSTALL_DIR/$BINARY_NAME"
}

check_brew_available() {
  command -v brew >/dev/null 2>&1
}

# Maps a channel name to the qualified cask reference. Pure; tested directly.
cask_for_channel() {
  case "$1" in
    stable) printf 'contextbridge/tap/cli\n' ;;
    alpha)  printf 'contextbridge/tap/cli@alpha\n' ;;
    *) return 1 ;;
  esac
}

# Maps a channel name to the alias path slug used under cli/<slug>/ in S3.
# Stable goes to the bare cli/latest/, alpha to cli/latest-alpha/. The slug
# also appears in tarball filenames (contextbridge_<slug>_OS_ARCH.tar.gz).
# Pure; tested directly.
slug_for_channel() {
  case "$1" in
    stable) printf 'latest\n' ;;
    alpha)  printf 'latest-alpha\n' ;;
    *) return 1 ;;
  esac
}

fail_brew_incompat() {
  cat >&2 <<EOF
error: --version, --bin-dir, CB_VERSION, or CB_INSTALL_DIR was set, but those knobs
are not honored by the Homebrew install path. Pass --no-brew (or set CB_NO_BREW=1)
to use the tarball installer instead.
EOF
  exit 1
}

install_via_brew() {
  _cask=$(cask_for_channel "$CB_CHANNEL") \
    || fail "internal error: unknown channel '$CB_CHANNEL'"
  info "installing via Homebrew: ${_cask}..."
  brew install --cask "$_cask" \
    || fail "brew install failed for ${_cask}. Pass --no-brew to use the tarball installer."
}

run_configure() {
  if [ "$CB_SKIP_CONFIGURE" = "1" ]; then
    info "skipping post-install configure (--no-configure / CB_SKIP_CONFIGURE=1)."
    return 0
  fi

  # Tarball path: use the explicit bin we just wrote, even if it's not on PATH yet.
  # Brew path: rely on PATH (brew prefix bins are on PATH for any user that has brew).
  _binary_path=""
  if [ "$_install_method" = "tarball" ] && [ -x "$CB_INSTALL_DIR/$BINARY_NAME" ]; then
    _binary_path="$CB_INSTALL_DIR/$BINARY_NAME"
  elif command -v "$BINARY_NAME" >/dev/null 2>&1; then
    _binary_path=$(command -v "$BINARY_NAME")
  fi

  if [ -z "$_binary_path" ]; then
    info "note: could not locate $BINARY_NAME after install; skipping post-install configure."
    return 0
  fi

  # Only prompt when stdin is already the terminal. Attaching a terminal from a
  # non-interactive stdin is not reliable with Bun/Clack raw-mode prompts.
  printf '\n'
  if [ -t 0 ]; then
    info "configuring detected AI coding harnesses..."
    "$_binary_path" install || _configure_warn
  else
    info "note: stdin is not an interactive terminal; skipping post-install configure."
    info "run '$BINARY_NAME install' from a terminal to choose which harnesses to wire up."
  fi
}

_configure_warn() {
  printf '\n'
  info "note: '$BINARY_NAME install' did not complete. If no harnesses were detected,"
  info "install your harness and re-run '$BINARY_NAME install'."
}

print_done() {
  printf '\n'
  if [ "$_install_method" = "brew" ]; then
    bold "contextbridge installed via Homebrew."
    printf '\nget started: %shttps://plan.contextbridge.ai/quickstart/%s\n' "$(fmt_code_on)" "$(fmt_code_off)"
    print_release_notes_link
    return 0
  fi

  bold "contextbridge ${CB_VERSION:-$_slug} installed to $CB_INSTALL_DIR/$BINARY_NAME"
  case ":$PATH:" in
    *":$CB_INSTALL_DIR:"*)
      printf '\nget started: %shttps://plan.contextbridge.ai/quickstart/%s\n' "$(fmt_code_on)" "$(fmt_code_off)"
      ;;
    *)
      printf '\n%s is not on your PATH. Add this to your shell profile:\n\n' "$CB_INSTALL_DIR"
      # shellcheck disable=SC2016  # literal $PATH is intentional — this is copy-paste text for the user's rc
      printf '  export PATH="%s:$PATH"\n\n' "$CB_INSTALL_DIR"
      printf 'then re-open your shell and visit %shttps://plan.contextbridge.ai/quickstart/%s\n' "$(fmt_code_on)" "$(fmt_code_off)"
      ;;
  esac
  print_release_notes_link
}

print_release_notes_link() {
  printf 'release notes: %shttps://github.com/contextbridge/planbridge/blob/main/CHANGELOG.md%s\n' \
    "$(fmt_code_on)" "$(fmt_code_off)"
}

# ---- helpers ----

info() { printf '%s\n' "$1"; }
fail() { printf 'error: %s\n' "$1" >&2; exit 1; }
bold() { if [ -t 1 ]; then printf '\033[1m%s\033[0m\n' "$1"; else printf '%s\n' "$1"; fi; }
fmt_code_on() { if [ -t 1 ]; then printf '\033[1m'; fi; }
fmt_code_off() { if [ -t 1 ]; then printf '\033[0m'; fi; }

http_download() {
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error --location --output "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget --quiet -O "$2" "$1"
  else
    fail "neither curl nor wget is available"
  fi
}

verify_checksum() {
  _file="$1"; _name="$2"; _checksums="$3"
  _expected=$(awk -v n="$_name" '$2 == n || $2 == "*"n { print $1; exit }' "$_checksums")
  [ -n "$_expected" ] || fail "could not find checksum for $_name in checksums.txt"

  if command -v sha256sum >/dev/null 2>&1; then
    _actual=$(sha256sum "$_file" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    _actual=$(shasum -a 256 "$_file" | awk '{print $1}')
  else
    fail "neither sha256sum nor shasum is available for checksum verification"
  fi

  if [ "$_actual" != "$_expected" ]; then
    fail "checksum mismatch for $_name: expected $_expected, got $_actual"
  fi
  info "checksum verified."
}

# Tests source this file with CB_INSTALL_SH_LIB=1 to avoid running main.
if [ "${CB_INSTALL_SH_LIB:-}" != "1" ]; then
  main "$@"
fi
