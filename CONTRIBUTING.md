# Contributing to PlanBridge

Thanks for your interest in contributing. This document covers local setup, the development loop, and the release process.

The deeper conventions (dependency injection, file naming, testing patterns) live in [`AGENTS.md`](./AGENTS.md). Each `packages/*` directory has its own `AGENTS.md` for package-specific guidance. Read those once before opening a non-trivial PR.

## Prerequisites

You need [`asdf`](https://asdf-vm.com/) and [`prek`](https://prek.j178.dev/) on your `PATH`. `bun` and `just` are pinned in `.tool-versions` and installed for you by the bootstrap step.

## Setup

```sh
git clone https://github.com/contextbridge/planbridge.git
cd planbridge
just bootstrap          # asdf toolchain, prek hooks, bun install
bun run dev -- --help
```

The `tools/` directory is a private git submodule (`contextbridge/planbridge-private`) used by maintainers and trusted CI for projen, infrastructure, and the website. You do not need it to contribute. If you have access and want it locally:

```sh
just tools-init
```

Skip that step otherwise. Nothing in `packages/` depends on it.

## Repo layout

```
packages/
├── cli/              @contextbridge/cli, the contextbridge binary
├── plan/             @contextbridge/plan, Vite + React browser UI for plan review
├── server/           @contextbridge/server, local Bun.serve HTTP library
├── shared/           @contextbridge/shared, types and zod schemas
├── ui/               @contextbridge/ui, shared CSS, fonts, shadcn components
├── context/          @contextbridge/context, BaseContext + FrontendContext
└── instrumentation/  @contextbridge/instrumentation, PostHog + Sentry wrappers
```

Each public workspace publishes under `@contextbridge/<short-name>` and uses `workspace:*` for sibling deps. See [`AGENTS.md`](./AGENTS.md) for the full layout, naming, and import rules.

## Development loop

```sh
bun run dev -- --help
bun run dev -- plan --help
echo "# Sample plan" | bun run dev -- plan
```

`bun run dev` runs the CLI from source against your changes. The plan command opens a browser window served from `packages/plan` and prints the structured submission to stdout when you submit.

Subcommand handlers live in `packages/cli/src/commands/`. The plan handler (`planHandler.ts`) is the canonical example of the Context pattern.

## Verification

Run `just verify` before opening a PR. It runs four steps:

1. `bun run format:check` (Prettier)
2. `bun run typecheck`
3. `bun run lint` (ESLint with `--max-warnings 0`)
4. `bun run test` (per-package dispatch; Bun's test runner for most packages, vitest for `@contextbridge/plan`)

Do not run `bun test` at the repo root. It walks every `*.test.ts` file with Bun's runner, which breaks the plan package's vitest browser-mode tests. Use `bun run test` (the dispatch script) or `bun run --cwd packages/<pkg> test` for a single package.

## Code conventions

Follow [`AGENTS.md`](./AGENTS.md). Highlights:

- Dependency injection via the Context pattern. No module-level singletons or global mocks.
- camelCase filenames (PascalCase only when the primary export is a class).
- Tests co-located next to the implementation (`foo.ts` and `foo.test.ts` in the same directory).
- [`fishery`](https://github.com/thoughtbot/fishery) factories for test fixtures, in `packages/<pkg>/src/testFactories.ts`.
- `Temporal` from `@contextbridge/shared/time` for time, not `Date`.
- Subpath imports (`#src/...`) for intra-package refs; the package name for cross-package refs.

## Pull requests

PR titles use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, etc.). Do not include the issue ID in the title. The PR template at [`.github/pull_request_template.md`](./.github/pull_request_template.md) covers the body format.

Before pushing, make sure `just verify` is clean.

## Releases

Maintainer-only. Both stable and alpha share one pipeline: any `vX.Y.Z*` tag pushed to the repo triggers `.github/workflows/release.yml`, which runs GoReleaser's Quill-backed signing and notarization for `darwin-arm64`, `darwin-x64`, `linux-x64`, and `linux-arm64`, uploads the binaries as GitHub Release assets, and commits a Homebrew cask to `contextbridge/homebrew-tap`.

The tag shape decides which cask is updated:

- **Stable** (`vX.Y.Z`) updates the `cli` cask. The `cli@alpha` cask is left alone.
- **Alpha** (`vX.Y.Z-alpha.N`) updates the `cli@alpha` cask. The `cli` cask is left alone. The GitHub Release is flagged prerelease automatically.

Both paths land users in the same end state: the binary on `PATH` and detected AI coding harnesses configured. `contextbridge install` is the canonical post-install step. Without it, the hooks are not wired up and the product does not do useful work. The Homebrew cask prints `caveats` instructing the user to run it. The curl installer runs it for them when stdin is a terminal (skip with `--no-configure` or `CB_SKIP_CONFIGURE=1` for CI).

The `scripts/install.sh` script defaults to the brew path when `brew` is on `PATH`. Otherwise it falls back to a tarball install: it resolves the latest version per channel by reading the cask file in the public `contextbridge/homebrew-tap` repo (the single source of truth for "current version per channel"), downloads the matching tarball from CloudFront, verifies the SHA256 against `checksums.txt`, and installs to `~/.local/bin` (override with `--bin-dir` or `CB_INSTALL_DIR`). Pin a specific version with `--version vX.Y.Z` or `CB_VERSION`. Force the tarball path even when brew is available with `--no-brew` or `CB_NO_BREW=1`.

### Cutting a stable release

```sh
just release stable <major|minor|patch>
```

`scripts/releaseStable.ts` validates the working tree is clean and you are on `main`, fetches the latest stable tag from GitHub via `gh`, increments it, and pushes the new `vX.Y.Z` tag.

### Cutting an alpha prerelease

```sh
just release alpha <major|minor|patch>
```

The `<major|minor|patch>` argument names the _next stable_ this alpha is building toward. If the latest stable is `v0.1.0`, `just release alpha patch` targets `v0.1.1`. `scripts/releaseAlpha.ts` validates the tree and branch, reads the latest GitHub releases, and pushes the next tag in the series:

- If alphas already exist for the target stable (e.g. `v0.1.1-alpha.2`), it bumps the counter to `v0.1.1-alpha.3`.
- Otherwise it starts a fresh series at `v0.1.1-alpha.0`.
- If no stable release exists yet, baseline `0.0.0` is assumed, so `just release alpha patch` produces `v0.0.1-alpha.N`.

To move to a different target (for example, promote a patch series to a minor), pass the larger increment. `just release alpha minor` jumps to `v0.2.0-alpha.0`.

### Local verification

```sh
just build              # host-platform binary in dist/contextbridge
just release dry-run    # full goreleaser run, no publish, sign, or notarize
```

The dry run requires `goreleaser` on `PATH` (`brew install goreleaser/tap/goreleaser`).

## Code of conduct

Be kind. Assume good faith. If something feels off, email [`support@contextbridge.ai`](mailto:support@contextbridge.ai) or reach a maintainer in [Slack](https://go.contextbridge.ai/join-community).
