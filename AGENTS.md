Please also reference the following rules as needed. The list below is provided in TOON format, and `@` stands for the project root directory.

rules[11]:
  - path: @.agents/memories/bun-native-apis.md
    description: Prefer Bun.* globals over their Node equivalents in Bun-only code
    applyTo[7]: packages/cli/**/*.ts,packages/server/**/*.ts,packages/skills/**/*.ts,packages/storage/**/*.ts,packages/harness/**/*.ts,packages/instrumentation/src/node/**/*.ts,packages/*/scripts/**/*.ts
  - path: @.agents/memories/bun-testing.md
    description: "bun:test matcher and lifecycle gotchas that have bitten us"
    applyTo[6]: packages/cli/**/*.test.ts,packages/context/**/*.test.ts,packages/instrumentation/**/*.test.ts,packages/server/**/*.test.ts,packages/shared/**/*.test.ts,packages/ui/**/*.test.ts
  - path: @.agents/memories/context-interfaces-and-fakes.md
    description: "Public interfaces, XxxImpl production classes, and FakeXxx test doubles for context dependencies"
    applyTo[3]: packages/context/**/*.ts,packages/*/src/context.ts,packages/*/src/**/*Context*.ts
  - path: @.agents/memories/generated-files.md
    description: "Generated AI-tool config — change it via .rulesync/, never the output files"
    applyTo[7]: AGENTS.md,CLAUDE.md,.mcp.json,.claude/rules/**,.agents/memories/**,.codex/config.toml,.rulesync/**
  - path: @.agents/memories/neverthrow-error-handling.md
    description: neverthrow Result types for fallible I/O instead of scattered try/catch
    applyTo[2]: packages/**/*.ts,packages/**/*.tsx
  - path: @.agents/memories/plan-review-design.md
    description: Utilitarian design language for the annotation and review browser UIs
    applyTo[6]: packages/annotation/**/*.tsx,packages/annotation/**/*.ts,packages/annotation/**/*.css,packages/review/**/*.tsx,packages/review/**/*.ts,packages/review/**/*.css
  - path: @.agents/memories/planbridge-skills.md
    description: Authoring a PlanBridge skill and regenerating the per-harness SKILL.md output
    applyTo[5]: packages/skills/sources/**/SKILL.md,packages/skills/src/codex.ts,packages/harness/src/registry.ts,harnessIntegrations/claude/skills/**/SKILL.md,harnessIntegrations/codex/skills/**/SKILL.md
  - path: @.agents/memories/react-compiler-memoization.md
    description: React Compiler auto-memoizes — the narrow cases where useCallback / useMemo still earn their keep
    applyTo[2]: packages/**/*.tsx,packages/**/src/**/*.ts
  - path: @.agents/memories/react-hook-design.md
    description: Recurring design decisions when writing or reviewing a custom React hook
    applyTo[2]: packages/**/*.tsx,packages/**/src/**/use*.ts
  - path: @.agents/memories/testing-patterns.md
    description: "Fishery factories, shared test helpers, colocated testIds, and exported copy constants"
    applyTo[6]: packages/**/*.test.ts,packages/**/*.test.tsx,packages/**/*TestIds*,packages/**/testFactories.ts,packages/**/*.tsx,packages/**/src/**/*.ts
  - path: @.agents/memories/website-writing-style.md
    description: Human-sounding prose for the docs and marketing site
    applyTo[2]: packages/website/src/**/*.mdx,packages/website/src/**/*.astro

# Additional Conventions Beyond the Built-in Functions

As this project's AI coding tool, you must follow the additional conventions below, in addition to the built-in functions.

# ContextBridge CLI (`contextbridge`)

> This file — and the other AI-tool config rulesync generates (`.claude/rules/`,
> `.agents/memories/`, `.mcp.json`, and the MCP servers in `.codex/config.toml`) — comes
> from `.rulesync/` via [rulesync](https://github.com/dyoshikawa/rulesync). Edit the source
> there and run `just generated rulesync`; never edit the generated files directly.

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
│   ├── review/                # @contextbridge/review — Vite+React browser UI for code review (scaffold; functionality WIP)
│   ├── storybook/             # @contextbridge/storybook — shared Storybook host + Chromatic publish for browser-UI packages
│   └── website/               # @contextbridge/website — Astro + Starlight marketing/docs site
├── .rulesync/                 # source of truth for the generated AI-tool config
├── tsconfig.base.json         # shared TS compiler options
├── package.json               # root workspace ("workspaces": ["packages/*"])
└── justfile                   # root-level recipes
```

`planbridge-private` is a separate private repository for employee-only infrastructure and release plumbing. It is not part of this public checkout.

Package naming: every workspace is `@contextbridge/<short-name>`. Browser UIs are named by capability — `annotation` for the kind-agnostic markdown annotation engine, `review` for file-change review — never a generic `-ui` suffix. Libraries that multiple experiences share (shared contracts, context, server) are their own packages. The shared Storybook host (`packages/storybook`) aggregates stories from every browser-UI package and owns the Chromatic publish.

Each package has its own hand-written `AGENTS.md` with package-specific guidance (plus a one-line `CLAUDE.md` stub that imports it via `@AGENTS.md` so Claude Code auto-loads it when editing files in that directory). **The stub is load-bearing** — Claude Code discovers ancestor `CLAUDE.md` on file edits but not standalone `AGENTS.md`; don't drop it. Those per-package files are outside rulesync's scope; only the root pair is generated. `packages/shared` and `packages/server` don't have their own files — they have no package-specific guidance beyond root conventions.

## Verification

Before marking a task complete, run `just verify` and fix anything that fails. It runs these steps in order:

- `bun run format:check` — Prettier
- `bun run typecheck` — strict TypeScript check (`bun run --filter '*' typecheck`)
- `bun run lint` — ESLint (`--max-warnings 0`)
- `bun run rulesync:check` — fails if the generated AI-tool config has drifted from `.rulesync/`
- `bun run skills:check` — fails if `harnessIntegrations/` has drifted from `packages/skills/sources/`
- `bun run test` — dispatches per-package `test` scripts. Most packages use Bun's test runner; the browser-UI packages (`@contextbridge/annotation`, `@contextbridge/review`) use **vitest** (browser mode via Playwright/Chromium) because their tests depend on real DOM, CSS Custom Highlights, and selection APIs that Bun's runner can't provide. `@contextbridge/website` runs Astro checks and build through its package test script.

Do **not** run `bun test` at the repo root — it walks every `*.test.ts` file with Bun's runner, which blows up on the browser-UI packages' vitest/browser tests. Use `bun run test` (the dispatch script) or a targeted `bun run --cwd packages/<pkg> test` during iteration.

Two generators keep committed output in the tree:

```sh
just generated rulesync   # regenerate AI-tool config from .rulesync/
bun run skills:generate   # regenerate harnessIntegrations/ from packages/skills/sources/
```

## Pull requests

Before opening a PR, read `.github/pull_request_template.md` and follow it exactly — section structure, title rules, and inline-comment guidance.

## Conventions

Detailed, path-scoped conventions live in separate rule files that your AI tool loads
automatically for the files you touch (authored in `.rulesync/rules/`, generated into
`.claude/rules/` and `.agents/memories/`). The repo-wide rules are below.

- **Dependency injection is non-negotiable.** Prefer explicit context-object wiring over module-level singletons or global mocking.
- **Tests with Bun's test runner** (except the browser-UI packages `@contextbridge/annotation` and `@contextbridge/review`; see above), co-located inline next to the implementation file (e.g. `planHandler.ts` → `planHandler.test.ts` in the same directory). Do **not** use `__tests__/` directories or a top-level `tests/` tree. A round-trip test for any new subcommand (input → UI submit → stdout payload) is expected. See the **testing-patterns** and **bun-testing** rules.
- **Helpers at the bottom of files.** Primary exports come first; module-local helpers, factories, and private utilities sit below them. In test files, helpers and local factories live **after** all `describe()` blocks — never interleaved or at the top.
- **In Zod string schemas, prefer `.nonempty()` over `.min(1)`.** Use `.trim().nonempty()` when surrounding whitespace should not count.
- **Destructured defaults over `??` fallbacks.** When applying defaults to an options bag or similar object, use a single destructuring assignment with defaults instead of per-field `??`. Write `const { version = '0.0.0-development' } = input;`, not `const version = input.version ?? '0.0.0-development';`. Keeps all the defaults for a function's input surface in one readable place.
- **Use Temporal for all time handling.** Use `@js-temporal/polyfill` via `@contextbridge/shared/time`, keep in-process values as Temporal objects, serialize only ISO strings at JSON boundaries, prefer `Temporal.Instant` for persisted or wire timestamps, and do not use `Date`.
- **Fallible operations return `Result<T, E>`** from `neverthrow` rather than throwing. See the **neverthrow-error-handling** rule.

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

**`ctx` always comes first in argument ordering.** When a helper takes a context, list it as the first parameter (`fn(ctx, other, args)`) and destructure internally. Uniform ordering keeps call sites predictable and makes the context's role obvious at a glance. See the **context-interfaces-and-fakes** rule for the interface / `XxxImpl` / `FakeXxx` split.
