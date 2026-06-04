---
topic: inbox-frontend
tags:
  - inbox
  - frontend
  - browser-ui
  - vitest
updated: '2026-06-04'
---

- `packages/inbox` is a Vite+React+Tailwind browser UI package following the same pattern as `@contextbridge/annotation` and `@contextbridge/review`.
- Tests use vitest browser mode (Playwright/Chromium). Must add `afterEach(cleanup)` from `@testing-library/react` — auto-cleanup from `@testing-library/jest-dom/vitest` doesn't reliably work in vitest browser mode.
- Fishery factories in the package use fixed default values (no `sequenceId` — fishery v2 doesn't have it). Tests that need unique items must override `id`, `nodeId`, `url`, and `number` explicitly.
- The `useInboxSnapshot` hook cannot call `setState` synchronously in a `useEffect` body (triggers `react-hooks/set-state-in-effect`). Use `LOADING_STATE` as frozen initial state and only update state via async callbacks.
- `void` operator needed for fire-and-forget promises in event handlers (`void refresh(...)`, `void apiClient.openItem(...)`) to satisfy `@typescript-eslint/no-floating-promises`.
- CLI bundle shim at `packages/cli/src/inbox/bundledInboxHtml.ts` uses `import html from '../../../inbox/dist/index.html' with { type: 'text' }` — same pattern as review.
- Inbox stories are registered in `packages/storybook/.storybook/main.ts` alongside annotation and review.
- Root `eslint.config.mjs` `reactFiles` array includes `packages/inbox/src/**/*.{ts,tsx}` for React plugin rules.
