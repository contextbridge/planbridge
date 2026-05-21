# planbridge justfile

mod release 'just/release.just'

# Default recipe - list available commands
default:
    @just --list

# Install dependencies
install:
    bun install {{ if env("CI", "") != "" { "--frozen-lockfile" } else { "" } }}

# Compile a host-platform binary. For cross-platform builds, use `just release dry-run`.
build version="0.0.0-development":
    __CB_VERSION__={{ version }} bun run --cwd packages/annotation build
    __CB_VERSION__={{ version }} bun run --cwd packages/review build
    bun run --cwd packages/cli build:compile {{ version }}

# Full verification: format + typecheck + lint + test
verify: install
    bun run format:check
    bun run typecheck
    bun run lint
    bun run skills:check
    bun run test

# Bootstrap development environment (install deps, git hooks)
bootstrap:
    asdf install
    prek install
    just install

# Run Storybook for the monorepo's browser-UI packages
storybook:
    bun run --cwd packages/storybook storybook

# Run the marketing website dev server (http://localhost:4321)
website:
    bun run --cwd packages/website dev

# Re-record the homepage demo video from the plan-app DemoFlow story
record-demo:
    bun run --cwd packages/annotation record-demo
