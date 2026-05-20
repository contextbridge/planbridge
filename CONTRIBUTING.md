# Contributing to PlanBridge

## Setup

You need [`asdf`](https://asdf-vm.com/) and [`prek`](https://prek.j178.dev/) installed and on your `PATH`. Then run:

```sh
git clone https://github.com/contextbridge/planbridge.git
cd planbridge
asdf install
just bootstrap          # asdf toolchain, prek hooks, bun install
bun run dev -- --help
```

## Repo layout

```
packages/
├── cli/              @contextbridge/cli, the contextbridge binary
├── annotation/       @contextbridge/annotation, Vite + React browser UI for annotating markdown documents
├── website/          @contextbridge/website, Astro + Starlight marketing/docs site
├── server/           @contextbridge/server, local Bun.serve HTTP library
├── shared/           @contextbridge/shared, types and zod schemas
├── ui/               @contextbridge/ui, shared CSS, fonts, shadcn components
├── context/          @contextbridge/context, BaseContext + FrontendContext
└── instrumentation/  @contextbridge/instrumentation, PostHog + Sentry wrappers
```

## Development

You can run PlanBridge locally via the following:

```sh
bun run dev -- --help
bun run dev -- plan --help
echo "# Sample plan" | bun run dev -- plan
```

Run the website locally with:

```sh
just website
```

## Testing

Use `just verify` to run all checks (format, lint, automated tests etc). For individual checks:

1. `bun run format` (Prettier)
2. `bun run typecheck`
3. `bun run lint` (ESLint)
4. `bun run test` (per-package; Bun's test runner for most packages, vitest for `@contextbridge/annotation`, Astro checks/build for `@contextbridge/website`)

## Coding Conventions

See [`AGENTS.md`](./AGENTS.md)

## Pull requests

1. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, etc.) for PR titles. The `Lint PR title` check enforces this.
2. Add a changeset for user-visible changes:
   - Run `bun run changeset` and write the release note in full sentences for ContextBridge users.
   - Use `patch`, `minor`, or `major` to declare the semver bump.
   - For changes that should not produce release notes — docs, tests, CI, refactors, website-only copy — omit the changeset. If a reviewer asks for an explicit marker, run `bun run changeset -- --empty`.
3. Adhere to the PR template [`.github/pull_request_template.md`](./.github/pull_request_template.md).
4. Before opening a PR ensure `just verify` runs without errors.

## Releases

Releases are cut by the ContextBridge team. Stable releases are automated by [Changesets](https://changesets.dev/) feeding into [goreleaser](https://goreleaser.com/):

- PR authors commit `.changeset/*.md` files with the release-note prose and semver bump.
- On pushes to `main`, Changesets opens or updates a `Version Packages` PR that consumes pending changesets, bumps the root package version, syncs the Claude plugin version, and prepends `CHANGELOG.md`.
- A maintainer chooses when to publish by merging the `Version Packages` PR. That creates the GitHub release and `vX.Y.Z` tag; goreleaser ships the binaries from the tag. Don't edit `CHANGELOG.md` by hand.
- Alpha releases are still manual: a maintainer pushes a `v{x.y.z}-alpha.N` tag and goreleaser handles the rest.

## Code of conduct

Be kind. Assume good faith. If something feels off, email [`support@contextbridge.ai`](mailto:support@contextbridge.ai) or reach a maintainer in [Slack](https://go.contextbridge.ai/join-community).
