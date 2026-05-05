#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git submodule sync --recursive tools
git submodule update --init --remote --recursive tools

git -C tools checkout main
git -C tools pull --rebase

bun install --cwd tools --frozen-lockfile
