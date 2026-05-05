# cb-cli justfile

mod release 'just/release.just'
mod infra 'just/infra.just'

# Default recipe - list available commands
default:
    @just --list

# Install dependencies (also refreshes the private tools submodule if initialized)
install:
    bun install {{ if env("CI", "") != "" { "--frozen-lockfile" } else { "" } }}
    @if [ -e tools/.git ]; then \
        if [ "$(git -C tools rev-parse --abbrev-ref HEAD)" = "main" ]; then \
            git -C tools pull --rebase; \
        fi; \
        bun install --cwd tools {{ if env("CI", "") != "" { "--frozen-lockfile" } else { "" } }}; \
    fi

# Initialize and install the private tools submodule (employees/trusted CI only)
tools-init:
    ./scripts/initToolsSubmodule.sh

# Install the private tools workspace after it has been initialized
tools-install:
    test -f tools/package.json || (echo "Private tools submodule is not initialized. Run: just tools-init" >&2; exit 1)
    bun install --cwd tools --frozen-lockfile

# Compile a host-platform binary. For cross-platform builds, use `just release dry-run`.
build version="0.0.0-development":
    __CB_VERSION__={{ version }} bun run --cwd packages/plan build
    bun run --cwd packages/cli build:compile {{ version }}

# Full verification: format + typecheck + lint + test
verify: install
    bun run format:check
    bun run typecheck
    bun run lint
    bun run test

# Bootstrap development environment (install tools, deps, git hooks)
bootstrap:
    asdf install
    prek install
    just install

# Run Storybook for the plan review UI
storybook:
    bun run --cwd packages/plan storybook

# Run the marketing website dev server (http://localhost:4321). Source lives in
# the private `tools/` submodule; requires `just tools-init` first.
website:
    test -f tools/website/package.json || (echo "Private tools submodule is not initialized. Run: just tools-init" >&2; exit 1)
    bun run --cwd tools/website dev

# Re-record the homepage demo video from the plan-app DemoFlow story
record-demo:
    bun run --cwd packages/plan record-demo
