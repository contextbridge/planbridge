# AGENTS.md

## Project: ContextBridge CLI (`contextbridge`)

A Bun-based CLI that brings human-in-the-loop annotation into AI coding sessions. The engine is a kind-agnostic annotation loop: a caller feeds markdown content into a subcommand, the CLI opens a local browser UI where a human annotates or approves, and the result is returned on stdout so the caller — typically a Claude Code or Codex hook — can iterate. Today the only entrypoint is `contextbridge plan`, which is purpose-built for plan-mode handoffs.

The longer arc is a multi-tool CLI. Plan review is feature one; code review (`contextbridge review`), additional annotation surfaces, and session-data mining live as sibling subcommands on the same binary.

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict)
- **Monorepo:** bun workspaces with a flat `packages/` tree. No turbo.

## Repository layout

```
planbridge/
├── packages/                  # public bun workspace ("workspaces": ["packages/*"])
│   ├── cli/                   # @contextbridge/cli — the `contextbridge` binary
│   ├── context/               # @contextbridge/context — shared BaseContext + FrontendContext
│   ├── harness/               # @contextbridge/harness — canonical HarnessDescriptor + registry
│   ├── instrumentation/       # @contextbridge/instrumentation — PostHog + Sentry wrappers (node + browser)
│   ├── shared/                # @contextbridge/shared — types + zod schemas shared across packages
│   ├── server/                # @contextbridge/server — local Bun.serve HTTP library
│   ├── skills/                # @contextbridge/skills — SKILL.md sources + per-harness codegen + drift check
│   ├── storage/               # @contextbridge/storage — local SQLite + Drizzle schema
│   ├── ui/                    # @contextbridge/ui — shared CSS, fonts, cn(), shadcn components
│   ├── annotation/            # @contextbridge/annotation — Vite+React browser UI for annotating markdown documents
│   └── website/               # @contextbridge/website — Astro + Starlight marketing/docs site
├── tsconfig.base.json         # shared TS compiler options
├── package.json               # root workspace ("workspaces": ["packages/*"])
└── justfile                   # root-level recipes
```

`planbridge-private` is a separate private repository for employee-only infrastructure and release plumbing. It is not part of this public checkout.

Package naming: every workspace is `@contextbridge/<short-name>`. Browser UIs are named by capability — `annotation` for the kind-agnostic markdown annotation engine, later `review` for file-change review — never a generic `-ui` suffix. Future review surfaces (`packages/review` for file-change review, etc.) land as siblings. Libraries that multiple experiences share (shared contracts, context, server) are their own packages.

Each package has its own `AGENTS.md` with package-specific guidance (plus a one-line `CLAUDE.md` stub that imports it via `@AGENTS.md` so Claude Code auto-loads it when editing files in that directory). **The stub is load-bearing** — Claude Code discovers ancestor `CLAUDE.md` on file edits but not standalone `AGENTS.md`; don't drop it. `packages/shared` and `packages/server` don't have their own files — they have no package-specific guidance beyond root conventions.

## Verification

Before marking a task complete, run `just verify` and fix anything that fails. It runs four steps in order:

- `bun run format:check` — Prettier
- `bun run typecheck` — strict TypeScript check (`bun run --filter '*' typecheck`)
- `bun run lint` — ESLint (`--max-warnings 0`)
- `bun run test` — dispatches per-package `test` scripts. Most packages use Bun's test runner; `@contextbridge/annotation` uses **vitest** (browser mode via Playwright/Chromium) because the annotation UI tests depend on real DOM, CSS Custom Highlights, and selection APIs that Bun's runner can't provide. `@contextbridge/website` runs Astro checks and build through its package test script.

Do **not** run `bun test` at the repo root — it walks every `*.test.ts` file with Bun's runner, which blows up on the annotation package's vitest/browser tests. Use `bun run test` (the dispatch script) or a targeted `bun run --cwd packages/<pkg> test` during iteration.

## Pull requests

Before opening a PR, read `.github/pull_request_template.md` and follow it exactly — section structure, title rules, and inline-comment guidance.

## Conventions

- **Dependency injection is non-negotiable.** Prefer explicit context-object wiring over module-level singletons or global mocking.
- **Tests with Bun's test runner** (except `@contextbridge/annotation`; see above), co-located inline next to the implementation file (e.g. `planHandler.ts` → `planHandler.test.ts` in the same directory). Do **not** use `__tests__/` directories or a top-level `tests/` tree. A round-trip test for any new subcommand (input → UI submit → stdout payload) is expected.
- **Helpers at the bottom of files.** Primary exports come first; module-local helpers, factories, and private utilities sit below them. In test files, helpers and local factories live **after** all `describe()` blocks — never interleaved or at the top.
- **In Zod string schemas, prefer `.nonempty()` over `.min(1)`.** Use `.trim().nonempty()` when surrounding whitespace should not count.
- **Destructured defaults over `??` fallbacks.** When applying defaults to an options bag or similar object, use a single destructuring assignment with defaults instead of per-field `??`. Write `const { version = '0.0.0-development' } = input;`, not `const version = input.version ?? '0.0.0-development';`. Keeps all the defaults for a function's input surface in one readable place.
- **Use Temporal for all time handling.** Use `@js-temporal/polyfill` via `@contextbridge/shared/time`, keep in-process values as Temporal objects, serialize only ISO strings at JSON boundaries, prefer `Temporal.Instant` for persisted or wire timestamps, and do not use `Date`.
### File naming

- **camelCase** for all `.ts` / `.tsx` files: `planHandler.ts`, not `plan-handler.ts` or `plan_handler.ts`.
- **PascalCase is required when a file's primary export is a class at module level**, matching the class name (e.g. `UserRepository.ts` exports `class UserRepository`). Test files for those classes follow the same casing (`UserRepository.test.ts`).
- Tooling-mandated filenames (`tsconfig.json`, `package.json`, `README.md`, `eslint.config.mjs`, GitHub workflow files, etc.) follow upstream conventions.
- Directory names are lowercase.

### Imports

- **Subpath imports** for intra-package refs: every package declares `"imports": { "#src/*": "./src/*" }` in its `package.json`. Code writes `import { x } from '#src/context.ts';` for cross-directory imports. Same-directory siblings (e.g. `plan.test.ts` → `./plan.ts`) may stay relative.
- **Cross-package imports** use the package name: `import { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';`. Sibling dependencies are declared with `"workspace:*"`.
- **Schema files carry `Schema` in the filename.** Zod schema modules are named `xxxSchema.ts` (e.g. `annotationSchema.ts`) so it's obvious at the import site that you're pulling in schemas and their inferred types, not business logic.

### Dependency injection (Context pattern)

All business logic flows through a typed context object. The shape is a thin inheritance chain rooted in `@contextbridge/context`:

- **`BaseContext`** (`@contextbridge/context`) — the shared root. Carries `buildInfo` (compile-time constants — version, environment, PostHog key, Sentry DSNs), `logger` (pino), `distinctId` (anonymous id), `analytics`, and `telemetry`. Every surface extends this, so cross-cutting concerns live in one place.
- **`CliContext extends BaseContext`** (`packages/cli/src/context.ts`) — see `packages/cli/AGENTS.md`.
- **`ServerContext extends BaseContext`** (`packages/server/src/context.ts`) — today a direct alias; named for where server-specific fields will land.
- **`FrontendContext extends BaseContext`** (`@contextbridge/context/frontend`) — see `packages/context/AGENTS.md`. Narrows `telemetry` to `FrontendTelemetry` (adds `ErrorBoundary`). Package-specific frontend contexts extend it (e.g. `AnnotationAppContext`).

Instrumentation wiring (PostHog + Sentry, plus the anonymous-id store) lives in `@contextbridge/instrumentation` — see `packages/instrumentation/AGENTS.md` for the real-vs-noop gating and the Sentry.init / pinoIntegration ordering invariant.

Business output (stdout) and diagnostics (logger → stderr) stay on separate channels so piped consumers see clean stdout while humans get readable log output (pretty-printed when interactive).

**Always destructure `ctx` at the point of use.** Pull out the fields you need at the top of the function body (`const { io, logger } = ctx;`) rather than reaching through `ctx.io.stdout` at each call site. This narrows each handler to the surface it actually depends on and keeps test stubs honest.

**`ctx` always comes first in argument ordering.** When a helper takes a context, list it as the first parameter (`fn(ctx, other, args)`) and destructure internally. Uniform ordering keeps call sites predictable and makes the context's role obvious at a glance.

<!--CONTEXTBOT-START-->
<!-- ContextBridge auto-generated — do not edit. -->

The following files contain team conventions that must be adhered to; ensure you read them:

- [Error Handling Neverthrow](.contextbridge/rules/error-handling-neverthrow.md)
- [Testing Patterns](.contextbridge/rules/testing-patterns.md)

<!--CONTEXTBOT-END-->
