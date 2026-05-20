# AGENTS.md — @contextbridge/context

Shared root of the DI context inheritance chain. Every surface (CLI, server, frontend) extends types from this package so cross-cutting concerns (telemetry, feature flags, build info) land once and reach all of them. Root repo conventions still apply — see `../../AGENTS.md` for the `BaseContext → CliContext | ServerContext | FrontendContext` overview.

## What lives here

- **`BaseContext`** — the shared root. Carries:
  - `buildInfo` — compile-time constants (version, environment, and build-injected telemetry config)
  - `logger` — pino
  - `distinctId` — anonymous session id (resolved node-side via XDG by `@contextbridge/instrumentation`; passed to the browser via the CLI's `/config` route)
  - `telemetryDisabled` — the global telemetry disabled decision resolved by `isTelemetryDisabled`; when `true`, no telemetry SDK emits.
  - `analytics` — `Analytics` interface (PostHog wrapper or noop)
  - `telemetry` — `Telemetry` interface (Sentry wrapper or noop)
- **`isTelemetryDisabled({ buildInfo, env? })`** — the single canonical rule. Returns `true` if a known opt-out env var is set (`DO_NOT_TRACK`, `CONTEXTBRIDGE_TELEMETRY_DISABLED`) or the build isn't production. The CLI calls this once with `{ buildInfo, env }`, stores the answer on BaseContext, and ships it over the wire to the annotation UI via `FrontendConfig.telemetryDisabled` — the browser trusts that boolean rather than re-deriving.
- **`FrontendContext extends BaseContext`** (exported from `@contextbridge/context/frontend`) — the shared context for browser-rendered surfaces. Keep browser-wide injectable dependencies here, type context fields as narrow public interfaces, and use the package's lint rules plus code exploration to discover which concrete browser APIs are intentionally wrapped. Package-specific frontend contexts extend this (e.g. `AnnotationAppContext`) rather than forking it.

## Factory pattern

Each context is built via its `createXxxContext({ … })` factory — version resolution, logger construction, and other defaults are encapsulated inside. `createFrontendContext` additionally folds in instrumentation wiring by calling `createBrowserInstrumentation` internally; callers pass `{ config, surface }` (plus optional overrides) and get back a fully-wired frontend context.

Instrumentation implementations (PostHog + Sentry wrappers, noop + fake helpers, `getOrCreateAnonymousId`) live in **`@contextbridge/instrumentation`** — this package only owns the shape. See `packages/instrumentation/AGENTS.md` for the gating rules and the Sentry.init ordering requirement.

## Test helpers

Use `fake*Context` helpers from `@contextbridge/context/testHelpers` when writing unit tests that need a context. They default `analytics` and `telemetry` to recording fakes from `@contextbridge/instrumentation/testHelpers`, so tests can assert on captured events and exceptions by reading `ctx.analytics.captures` / `ctx.telemetry.exceptions`. Package-specific stub factories (e.g. `createStubContext()` in `packages/cli/src/testHelpers`) wrap these — they're the preferred entry point for tests in those packages.

## When to add a field here vs in a downstream context

- **Cross-cutting** (telemetry, feature flags, trace correlation id): goes on `BaseContext` here — every surface gets it for free.
- **Browser-only** (anything that needs `window`, `document`, or a DOM timer): goes on `FrontendContext` here.
- **Surface-specific** (commander streams, AWS SDK client, HTTP request): goes on the downstream context in the owning package, **not** here.
