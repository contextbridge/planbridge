# AGENTS.md — @contextbridge/inbox

Vite + React browser UI for the `contextbridge inbox` GitHub attention dashboard. The compiled bundle is embedded into the CLI binary at build time (see `packages/cli/AGENTS.md`).

The UI fetches an inbox snapshot from the local server (`GET /api/inbox/snapshot`) and renders prioritized pull requests and issues that need the viewer's attention. Users can filter by repository, item kind, time window, and inclusion of drafts/dependabot items.

Tests use **vitest browser mode (Playwright/Chromium)** — same setup as `@contextbridge/annotation` and `@contextbridge/review`. Run with `bun run --cwd packages/inbox test`.

Styling consumes `@contextbridge/ui` (`styles.css`, design tokens, shared primitives). The design language follows the utilitarian plan-review aesthetic documented in the project's design rules.

## Architecture

- `main.tsx` — React entrypoint, mounts `<App />`.
- `App.tsx` — Top-level component: fetches snapshot, manages filter state, renders layout.
- `apiClient.ts` — Typed fetch wrapper for the local server endpoints. Injected into components via context, not imported as a singleton.
- `useInboxSnapshot.ts` — Hook that manages snapshot loading, error, and refresh state.
- `context.ts` — Package-specific frontend context extending `FrontendContext` from `@contextbridge/context/frontend`.
- `components/` — UI components for header, filter bar, item cards, priority sections, and loading/empty/error states.
- `testFactories.ts` — Fishery factories for inbox types, used in tests.

## API endpoints

- `GET /api/inbox/snapshot?filters...` — Returns `InboxSnapshot` JSON.
- `POST /api/inbox/open` — Accepts `{ url }`, opens in system browser.
- `GET /health` — Health check.

## Conventions

- Follow all root `AGENTS.md` conventions (DI, Temporal for time, camelCase files, helpers at bottom of files).
- Export `xxxTestIds` objects from components for test selectors.
- Export `xxxCopy` objects for user-visible text asserted in tests.
- No manual `useCallback`/`useMemo` — React Compiler handles memoization.
