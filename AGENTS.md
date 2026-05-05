# AGENTS.md

## Project: ContextBridge CLI (`contextbridge`)

A Bun-based CLI that brings human-in-the-loop annotation into AI coding sessions. The first capability is **plan review**: a user (or a harness hook) feeds a proposed plan into `contextbridge plan`, the CLI opens a local browser UI where a human annotates or approves, and the result is returned on stdout so the caller — typically a Claude Code or Codex hook — can iterate.

The longer arc is a multi-tool CLI. Plan review is feature one; code review (`contextbridge review`), additional annotation surfaces, and session-data mining live as sibling subcommands on the same binary.

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict)
- **Monorepo:** bun workspaces with a flat `packages/` tree. No turbo.

## Repository layout

```
cb-cli/
├── packages/                  # public bun workspace ("workspaces": ["packages/*"])
│   ├── cli/                   # @contextbridge/cli — the `contextbridge` binary
│   ├── context/               # @contextbridge/context — shared BaseContext + FrontendContext
│   ├── instrumentation/       # @contextbridge/instrumentation — PostHog + Sentry wrappers (node + browser)
│   ├── shared/                # @contextbridge/shared — types + zod schemas shared across packages
│   ├── server/                # @contextbridge/server — local Bun.serve HTTP library
│   ├── ui/                    # @contextbridge/ui — shared CSS, fonts, cn(), shadcn components
│   └── plan/                  # @contextbridge/plan — Vite+React browser UI for plan review
├── tools/                     # private git submodule for employees/trusted CI only
│   ├── projen/                # projen runner (uses private @contextbridge/projen)
│   ├── infrastructure/        # AWS CDK stacks + release pipeline (uses private @contextbridge/infrastructure)
│   └── website/               # @contextbridge/website — Astro + Starlight marketing/docs site (projen-managed, ships as a CDK asset)
├── tsconfig.base.json         # shared TS compiler options
├── package.json               # root workspace ("workspaces": ["packages/*"])
└── justfile                   # root-level recipes
```

`tools/` is a private git submodule backed by `contextbridge/planbridge-private`, not public source in this repository. Public contributors should not initialize it; a normal clone plus root `bun install` and `just verify` are sufficient. Employees and trusted CI with access can run:

```sh
just install
just tools-init
```

Tools changes are developed in the private repo and then pinned here by updating the submodule pointer. Projen synth may modify both repositories; commit private `tools/` changes in `planbridge-private` and public generated changes in `cb-cli` separately.

Package naming: every workspace is `@contextbridge/<short-name>`. Review-experience UIs are named by feature (`plan`, later `review`) — never a generic `-ui` suffix. Future review surfaces (`packages/review` for file-change review, etc.) land as siblings. Libraries that multiple experiences share (shared contracts, context, server) are their own packages.

Each package has its own `AGENTS.md` with package-specific guidance (plus a one-line `CLAUDE.md` stub that imports it via `@AGENTS.md` so Claude Code auto-loads it when editing files in that directory). **The stub is load-bearing** — Claude Code discovers ancestor `CLAUDE.md` on file edits but not standalone `AGENTS.md`; don't drop it. `packages/shared` and `packages/server` don't have their own files — they have no package-specific guidance beyond root conventions.

### `tools/website` (projen-managed)

The marketing/docs site lives in the private `planbridge-private` submodule rather than `packages/` because it deploys as a CDK asset of `MarketingWebsiteStack` — keeping source colocated with the stack that ships it. It is the only projen-managed package in the monorepo. Projen config lives in the same submodule at `tools/projen/.projenrc.ts`: a bare `projen.Project` acts as a shell that hosts a `GitHub` component plus the website as a child subproject (`outdir: '../..'` from the submodule). Public contributors do not need to initialize the submodule or run projen synth; building the website locally requires `just tools-init` first.

## Verification

Before marking a task complete, run `just verify` and fix anything that fails. It runs four steps in order:

- `bun run format:check` — Prettier
- `bun run typecheck` — strict TypeScript check (`bun run --filter '*' typecheck`)
- `bun run lint` — ESLint (`--max-warnings 0`)
- `bun run test` — dispatches per-package `test` scripts. Most packages use Bun's test runner; `@contextbridge/plan` uses **vitest** (browser mode via Playwright/Chromium) because the plan UI tests depend on real DOM, CSS Custom Highlights, and selection APIs that Bun's runner can't provide.

Do **not** run `bun test` at the repo root — it walks every `*.test.ts` file with Bun's runner, which blows up on the plan package's vitest/browser tests. Use `bun run test` (the dispatch script) or a targeted `bun run --cwd packages/<pkg> test` during iteration.

The website is **not** dispatched by the root `test` script: it lives in a separate bun workspace inside the `tools/` submodule, and not all contributors initialize that submodule. Run its checks via `bun run --cwd tools/website test` (or `just tools-install && just verify` from a tools-initialized checkout) when changing the site.

## Conventions

- **Dependency injection is non-negotiable.** Prefer explicit context-object wiring over module-level singletons or global mocking.
- **Tests with Bun's test runner** (except `@contextbridge/plan`; see above), co-located inline next to the implementation file (e.g. `planHandler.ts` → `planHandler.test.ts` in the same directory). Do **not** use `__tests__/` directories or a top-level `tests/` tree. A round-trip test for any new subcommand (input → UI submit → stdout payload) is expected.
- **Helpers at the bottom of files.** Primary exports come first; module-local helpers, factories, and private utilities sit below them. In test files, helpers and local factories live **after** all `describe()` blocks — never interleaved or at the top.
- **In Zod string schemas, prefer `.nonempty()` over `.min(1)`.** Use `.trim().nonempty()` when surrounding whitespace should not count.
- **Destructured defaults over `??` fallbacks.** When applying defaults to an options bag or similar object, use a single destructuring assignment with defaults instead of per-field `??`. Write `const { version = '0.0.0-development' } = input;`, not `const version = input.version ?? '0.0.0-development';`. Keeps all the defaults for a function's input surface in one readable place.
- **Use Temporal for all time handling.** Use `@js-temporal/polyfill` via `@contextbridge/shared/time`, keep in-process values as Temporal objects, serialize only ISO strings at JSON boundaries, prefer `Temporal.Instant` for persisted or wire timestamps, and do not use `Date`.
- **Test factories use [fishery](https://github.com/thoughtbot/fishery).** Shared factories live in `@contextbridge/shared/testFactories` (see `packages/shared/src/testFactories.ts`). Build fixtures with `commentMessage.build({ body: '…' })`, not hand-rolled `createXxx({ overrides })` helpers. When a package needs package-specific factories, add them under `packages/<pkg>/src/testFactories.ts` following the same `Factory.define<T>(() => ({ … }))` pattern.
- **Export component test IDs from the component file, not a central registry.** Each component that exposes test selectors declares its own `xxxTestIds` object next to the component definition (e.g. `export const annotationPopoverTestIds = { … }` in `AnnotationPopover.tsx`). Tests import that object directly. This avoids a single bloated `testIds.ts` and keeps ids colocated with the markup that uses them.

### File naming

- **camelCase** for all `.ts` / `.tsx` files: `planHandler.ts`, not `plan-handler.ts` or `plan_handler.ts`.
- **PascalCase is required when a file's primary export is a class at module level**, matching the class name (e.g. `UserRepository.ts` exports `class UserRepository`). Test files for those classes follow the same casing (`UserRepository.test.ts`).
- Tooling-mandated filenames (`tsconfig.json`, `package.json`, `README.md`, `eslint.config.mjs`, GitHub workflow files, etc.) follow upstream conventions.
- Directory names are lowercase.

### Imports

- **Subpath imports** for intra-package refs: every package declares `"imports": { "#src/*": "./src/*" }` in its `package.json`. Code writes `import { x } from '#src/context.ts';` for cross-directory imports. Same-directory siblings (e.g. `plan.test.ts` → `./plan.ts`) may stay relative.
- **Cross-package imports** use the package name: `import { AnnotatedResult } from '@contextbridge/shared/planReviewSchema';`. Sibling dependencies are declared with `"workspace:*"`.
- **Schema files carry `Schema` in the filename.** Zod schema modules are named `xxxSchema.ts` (e.g. `planReviewSchema.ts`) so it's obvious at the import site that you're pulling in schemas and their inferred types, not business logic.

### Dependency injection (Context pattern)

All business logic flows through a typed context object. The shape is a thin inheritance chain rooted in `@contextbridge/context`:

- **`BaseContext`** (`@contextbridge/context`) — the shared root. Carries `buildInfo` (compile-time constants — version, environment, PostHog key, Sentry DSNs), `logger` (pino), `distinctId` (anonymous id), `analytics`, and `telemetry`. Every surface extends this, so cross-cutting concerns live in one place.
- **`CliContext extends BaseContext`** (`packages/cli/src/context.ts`) — see `packages/cli/AGENTS.md`.
- **`ServerContext extends BaseContext`** (`packages/server/src/context.ts`) — today a direct alias; named for where server-specific fields will land.
- **`FrontendContext extends BaseContext`** (`@contextbridge/context/frontend`) — see `packages/context/AGENTS.md`. Narrows `telemetry` to `FrontendTelemetry` (adds `ErrorBoundary`). Package-specific frontend contexts extend it (e.g. `PlanAppContext`).

Instrumentation wiring (PostHog + Sentry, plus the anonymous-id store) lives in `@contextbridge/instrumentation` — see `packages/instrumentation/AGENTS.md` for the real-vs-noop gating and the Sentry.init / pinoIntegration ordering invariant.

Business output (stdout) and diagnostics (logger → stderr) stay on separate channels so piped consumers see clean stdout while humans get readable log output (pretty-printed when interactive).

**Always destructure `ctx` at the point of use.** Pull out the fields you need at the top of the function body (`const { io, logger } = ctx;`) rather than reaching through `ctx.io.stdout` at each call site. This narrows each handler to the surface it actually depends on and keeps test stubs honest.

**`ctx` always comes first in argument ordering.** When a helper takes a context, list it as the first parameter (`fn(ctx, other, args)`) and destructure internally. Uniform ordering keeps call sites predictable and makes the context's role obvious at a glance.
