#!/bin/sh
# Runs after the repo is cloned, before the agent starts. Installs deps for verify.
set -eu

# GitHub Packages auth for @contextbridge/* deps is read by bun from bunfig.toml's
# install.scopes via $GITHUB_PACKAGES_AUTH_TOKEN, forwarded by docker-compose.
bun install --frozen-lockfile

bunx playwright install chromium
