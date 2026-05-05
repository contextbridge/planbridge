# AGENTS.md — @contextbridge/instrumentation

Owns all telemetry wiring for every runtime surface: the shared `Analytics` / `Telemetry` interfaces, noop + fake impls, vendor SDK wrappers (posthog-node, @sentry/bun, posthog-js, @sentry/react), and the XDG-backed `getOrCreateAnonymousId()` helper. Consumers (CLI, plan UI, future surfaces) wire instrumentation into their own context in one factory call — they never depend on SDK packages directly. Root repo conventions still apply — see `../../AGENTS.md`.

## Subpath layout

- `.` — shared interfaces (`Analytics`, `Telemetry`) + noop impls. Zero SDK deps. Safe to import from any runtime.
- `/frontend` — `FrontendTelemetry` (narrows `Telemetry` with `ErrorBoundary: ComponentType<PropsWithChildren>`) + noop impl. Depends on React types only.
- `/node` — `createNodeInstrumentation({ buildInfo, distinctId, telemetryDisabled, surface? }) → { analytics, telemetry }`. Pulls `posthog-node` + `@sentry/bun` (a thin superset of `@sentry/node` that adds the `runtime: bun` tag and a Bun-native fetch transport; `pinoIntegration` is re-exported unchanged). Also exports `getOrCreateAnonymousId(env)` for the CLI to call when composing inputs.
- `/browser` — `createBrowserInstrumentation({ buildInfo, distinctId, telemetryDisabled, surface }) → { analytics, telemetry }`. Pulls `posthog-js` + `@sentry/react`. Telemetry includes a `Sentry.ErrorBoundary`-wrapped component.
- `/testHelpers` + `/testHelpers/frontend` — fakes (`FakeAnalytics`, `FakeTelemetry`, `FakeFrontendTelemetry`) with recording fields for assertions. **Test-only** — kept behind a separate subpath so prod bundles never include them.

## Factory pattern

One bundled factory per runtime. Both receive the global `telemetryDisabled` boolean resolved by `@contextbridge/context`:

- `createNodeInstrumentation({ buildInfo, distinctId, telemetryDisabled, surface? })` — `surface` defaults to `'cli'`. If `telemetryDisabled` is true, returns noops and **`Sentry.init` is never called** — pino is never patched. On the real path calls `Sentry.init({ ..., integrations: [Sentry.pinoIntegration({ error: { levels: ['error', 'fatal'] } })] })` and constructs the PostHog client with `cb_surface`, `cb_version`, `cb_environment`, `cb_channel` super-properties. The factory does **not** auto-identify — the CLI calls `analytics.identify(distinctId)` itself after `analytics.register({ cb_command })` so the per-invocation command path is captured on the identify event and on every subsequent capture.
- `createBrowserInstrumentation({ buildInfo, distinctId, telemetryDisabled, surface })` — `surface` tags events (`'plan'` today, `'review'` later). If `telemetryDisabled` is true, returns noops and a passthrough boundary. On the real path calls `Sentry.init({ dsn: buildInfo.sentryFrontendDsn, ... })` and wires a `Sentry.ErrorBoundary`.

## Sentry.init ordering (Node only)

`Sentry.pinoIntegration` patches pino globally at init time. `createContext()` on the CLI side **must** call `createNodeInstrumentation` before `createLogger` — otherwise `logger.error` / `logger.fatal` won't auto-forward to Sentry. That ordering lives in `packages/cli/src/context.ts`; this package just documents the invariant.

The browser has no equivalent concern — `Sentry.init` can run at any time.

## Opt-out

Two environment variables disable all outbound telemetry:

- `DO_NOT_TRACK=1` — cross-vendor opt-out convention
- `CONTEXTBRIDGE_TELEMETRY_DISABLED=1`

Either flag, truthy value (`1` / `true` / `yes`), disables both PostHog and Sentry. Non-production builds also disable telemetry. The canonical rule lives in `isTelemetryDisabled({ buildInfo, env })` in `@contextbridge/context`; the CLI computes it once and passes the resolved boolean to node instrumentation and to the browser via `FrontendConfig.telemetryDisabled`. The browser trusts that wire value rather than re-deriving.

## Privacy

User-authored content — plan markdown, annotation comments, future diff hunks — must never reach PostHog. Two rules keep it that way:

- **Browser PostHog runs with `autocapture: false`** (see `browser/postHogAnalytics.ts`). Plan content renders inside clickable annotatable elements, so autocapture would upload `$elements_text` on every click. Do not re-enable without review — intentional telemetry goes through explicit `analytics.capture(event, props)` calls.
- **Manual `analytics.capture` payloads carry no user content.** Send sizes (`bytes`, `comment_count`), durations, and categorical values. Never plan text, comment bodies, or other user-authored strings.

## Testing

Per-file co-located tests (Bun's runner). Fakes record captures / identifies / exceptions so consuming-package tests can assert on event payloads without touching the real SDKs. Fakes are exported from `@contextbridge/instrumentation/testHelpers` — import them in test files only.
