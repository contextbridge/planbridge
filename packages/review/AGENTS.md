# AGENTS.md — @contextbridge/review

Vite + React browser UI for the `contextbridge review` code-review flow. The compiled bundle is embedded into the CLI binary at build time (see `packages/cli/AGENTS.md`).

This package is currently a **scaffold**: the placeholder `<App>` renders a "coming soon" message and `contextbridge review` blocks until SIGINT. The real diff viewer (pierre `CodeView`, comment lifecycle, file list sidebar, submit bar) lands in the follow-up feature PR per `docs/superpowers/specs/2026-05-20-review-feature-design.md`.

Tests use **vitest browser mode (Playwright/Chromium)** — same setup as `@contextbridge/annotation`, since the diff viewer will rely on real DOM, CSS Custom Highlights, and selection APIs. Run with `bun run --cwd packages/review test`.

Styling consumes `@contextbridge/ui` (`styles.css`, design tokens). The design language is utilitarian, not SaaS — read `.claude/rules/plan-review-design.md` before adding visual weight; the rule auto-loads when editing files here.

## Storybook

This package's `*.stories.tsx` files live next to their components. The shared Storybook host that aggregates them is `@contextbridge/storybook` — run it with `bun run --cwd packages/storybook storybook` (or `just storybook`). When `ReviewAppContext` lands, add a sibling decorator under `src/testHelpers/` following the annotation pattern (`@contextbridge/annotation/src/testHelpers/appContextDecorator.tsx`); story files opt in to it explicitly because the shared host has no global decorator.
