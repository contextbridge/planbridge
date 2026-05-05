# cb-cli

The `contextbridge` CLI.

See [`AGENTS.md`](./AGENTS.md) for project overview and contributor conventions (file naming, DI pattern).

## Quick start

Prerequisites: [`asdf`](https://asdf-vm.com/) and [`prek`](https://prek.j178.dev/) on your `PATH` (`bun` and `just` are pinned in `.tool-versions` and installed by bootstrap). `bun install` pulls package dependencies through Bun's normal registry configuration.

Public setup does not require the private `tools/` submodule:

```sh
just bootstrap      # installs toolchain (asdf), git hooks (prek), and public deps (bun)
bun run dev -- --help
```

Employees with access to `contextbridge/planbridge-private` can initialize maintainer-only tools after public setup:

```sh
just tools-init
```

## Development

```sh
bun install
bun run dev -- --help
bun run dev -- plan --help
bun run test
```

## Plan review

`contextbridge plan` is the manual plan-review entrypoint for Claude Code, Codex, or any shell-driven workflow. It accepts plan content from a positional path or from stdin:

```sh
contextbridge plan plan.md
cat plan.md | contextbridge plan
```

Inside Claude Code or Codex, the intended manual flow is:

```sh
! contextbridge plan plan.md
```

After the browser review is submitted, stdout is markdown that the model can read directly. The Handlebars templates that drive that output live under [`packages/cli/src/formatters/plan/templates/`](packages/cli/src/formatters/plan/templates/) — treat those files as the source of truth for the wording sent back to the model.

## Dependency injection

This repo uses the **Context pattern** (`src/context.ts` + `src/testHelpers.ts`).
Subcommands call `createHandler(ctx)` which returns the function citty
dispatches to. Tests substitute a stub context from `createStubContext()`. See
`src/commands/planHandler.ts` for the canonical example.

When the React UI lands in a future PR, the built HTML will be embedded into
the compiled binary using `import html from "./ui/dist/index.html" with { type: "text" }`
and served via `Bun.serve`. Pattern reference: the `plannotator` repo.

## Building the binary

```sh
bun run build       # → dist/contextbridge
```

## Releases

Both channels share one pipeline: any `vX.Y.Z*` tag push triggers
`.github/workflows/release.yml`, which runs GoReleaser's Quill-backed
signing/notarization flow for `darwin-arm64`, `darwin-x64`, `linux-x64`, and
`linux-arm64`, uploads binaries as GitHub Release assets, and commits a Homebrew
cask to `contextbridge/homebrew-tap`. The tag shape decides which cask is
updated:

- **Stable** (`vX.Y.Z`) — cut via `just release stable` (below).
  Updates the `cli` cask; the `cli@alpha` cask is left untouched.

  ```sh
  # Homebrew (cask caveats prompt the user to run `contextbridge install`)
  brew install contextbridge/tap/cli
  contextbridge install

  # curl installer (auto-runs `contextbridge install` interactively)
  /bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)"
  ```

- **Alpha** (`vX.Y.Z-alpha.N`) — cut via `just release alpha` (below). Updates
  the `cli@alpha` cask; the `cli` cask is left untouched. The GitHub Release
  is flagged prerelease automatically.

  ```sh
  # Homebrew
  brew install contextbridge/tap/cli@alpha
  contextbridge install

  # curl installer
  /bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)" -- --channel alpha
  ```

Both paths land users in the same end state: the binary on PATH **and** detected
AI coding harnesses configured. `contextbridge install` is the canonical
post-install step — without it, hooks aren't wired up and the product doesn't
do useful work. The brew cask prints `caveats` instructing the user to run it;
the curl installer runs it for them when stdin is an interactive terminal (skip
with `--no-configure` / `CB_SKIP_CONFIGURE=1` for CI/automation). The documented
`/bin/sh -c "$(curl ...)"` form preserves terminal stdin for prompts.

The `install.sh` script defaults to the brew path when `brew` is on PATH (Mac
or Linux — the cask has `on_linux` blocks). Falls back to a tarball install
otherwise: it resolves the latest version per channel by reading the cask file
in `contextbridge/homebrew-tap` (the Homebrew tap is public and is the single
source of truth for "current version per channel"), downloads the matching
tarball from CloudFront, verifies the SHA256 against `checksums.txt`, and
installs to `~/.local/bin` (override via `--bin-dir` / `CB_INSTALL_DIR`). Pin a
specific version with `--version vX.Y.Z` / `CB_VERSION`. Force the tarball path
even when brew is available with `--no-brew` / `CB_NO_BREW=1`.

### Cutting a stable release

```sh
just release stable <major|minor|patch>
```

`scripts/releaseStable.ts` validates the working tree is clean and you're on
`main`, fetches the latest stable tag from GitHub via `gh`, increments it, and
pushes the new `vX.Y.Z` tag.

### Cutting an alpha prerelease

```sh
just release alpha <major|minor|patch>
```

The `<major|minor|patch>` arg names the **next stable** this alpha is building
toward — e.g. if the latest stable is `v0.1.0`, `just release alpha patch`
targets `v0.1.1`. `scripts/releaseAlpha.ts` validates the tree + branch, reads
the latest GitHub releases, and pushes the next tag in the series:

- If alphas already exist for the target stable (e.g. `v0.1.1-alpha.2`), it
  bumps the counter → `v0.1.1-alpha.3`.
- Otherwise it starts a fresh series → `v0.1.1-alpha.0`.
- If no stable release exists yet, baseline `0.0.0` is assumed, so
  `just release alpha patch` produces `v0.0.1-alpha.N`.

To move to a different target (e.g. promote a patch series to a minor),
pass the larger increment — `just release alpha minor` will jump to
`v0.2.0-alpha.0`.

### Local verification

```sh
just build              # host-platform binary → dist/contextbridge
just release dry-run   # full goreleaser run, no publish/sign/notarize
```

The dry-run requires `goreleaser` on `PATH` (`brew install goreleaser/tap/goreleaser`).
