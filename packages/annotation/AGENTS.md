# AGENTS.md — @contextbridge/annotation

Vite + React browser UI for annotating markdown documents. The compiled bundle is embedded into the `contextbridge` CLI binary at build time (see `packages/cli/AGENTS.md` for the bundle flow). Today the only caller is `contextbridge plan` (plan-mode handoffs from Claude Code and Codex). The UI itself is kind-agnostic — issue #51 (`contextbridge open <path>`) will widen this to arbitrary markdown documents, reusing the same bundle. Root repo conventions still apply — see `../../AGENTS.md`.

The core React surface is the `AnnotatedMarkdown` component, fed by the `useAnnotationState` hook and the `AnnotationAppContext` (extends `FrontendContext`). The context's `submitAnnotation` method posts the result back to the CLI's local HTTP server.

## Testing: vitest browser mode

Uses **vitest browser mode (Playwright/Chromium)** — the annotation UI tests depend on real DOM, CSS Custom Highlights, and selection APIs that Bun's runner can't provide. This is why `bun test` at the repo root is unusable: it walks every `*.test.ts` file with Bun's runner and blows up on these tests. Use `bun run test` (the dispatch script) or `bun run --cwd packages/annotation test` during iteration.

## Storybook

This package's `*.stories.tsx` files live next to their components. The shared Storybook host that aggregates them is `@contextbridge/storybook` — run it with `bun run --cwd packages/storybook storybook` (or `just storybook`). The opt-in app-context decorator for stories lives at `src/testHelpers/appContextDecorator.tsx`; story files import it explicitly because the shared host has no global decorator.

## Homepage demo asset

The homepage at `packages/website` uses a recorded `<video>` of the `Plan/App > FullDemo` story (`src/App.demo.stories.tsx`). The story renders `<DemoStage>`: two floating windows on a 1600×900 desktop — a fake Claude Code TUI (xterm.js) anchored top-left, and the real annotation UI anchored bottom-right that slides in over the terminal during review. The `play()` scripts the full lifecycle (prompt typed → plan streams → handoff → annotate → submit → refine → approve → implement). After material UI changes, regenerate the asset with `just record-demo` — it spawns the shared Storybook from `@contextbridge/storybook`, drives `FullDemo` via Playwright, and writes `plan-review.webm` into `packages/website/public/demo/` and `plan-review-poster.jpg` into `packages/website/src/assets/demo/` (the poster goes through Astro's image pipeline for AVIF/WebP variants and a hashed-immutable cache header).

Demo-only code lives under `src/demo/` (TerminalWindow, DemoStage, terminalScript, claudeCodeFrames). It is imported **only** from `*.stories.tsx`. xterm is a `devDependency`, not a runtime one. The production singlefile bundle (`vite build` → `dist/index.html`) must not contain xterm — verify with `grep -c xterm dist/index.html` (expect `0`). Anything that ends up reachable from `src/main.tsx` lands in the CLI binary, so don't import demo modules from production paths.

## Context

`AnnotationAppContext extends FrontendContext` from `@contextbridge/context/frontend`. Add annotation-UI-specific fields here (never fork `FrontendContext` itself — see `packages/context/AGENTS.md`).

## Styling

Consumes `@contextbridge/ui` — `styles.css` import in the entry, `cn()` helper, shared components under `@contextbridge/ui/components/*` (e.g. `Header`, `BrandMark`), and shadcn primitives under `@contextbridge/ui/components/ui/*`. See `packages/ui/AGENTS.md` for the wiring steps and the "do not remove" notes on the `@source` directive.

## Design language: utilitarian, not SaaS

This UI is a developer tool, not a marketing surface. Before adding visual weight (cards, shadows, large radii, tinted fills, backdrop-blur), read `.claude/rules/plan-review-design.md` — it owns the full set of rules. That file is auto-loaded when editing files in this package.
