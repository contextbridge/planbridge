# AGENTS.md — @contextbridge/storybook

Shared Storybook host for the monorepo's browser-UI packages. Owns `.storybook/` config, the Storybook + Chromatic devDeps, and the Chromatic workflow's build/publish working directory. Stories themselves stay co-located with their components in the consuming packages — today that's `@contextbridge/annotation` and `@contextbridge/review`. New browser-UI packages plug in by widening the `stories` glob in `.storybook/main.ts`.

## Running it

- `bun run --cwd packages/storybook storybook` — dev server on port 6006
- `bun run --cwd packages/storybook build-storybook` — static build into `storybook-static/`
- `SKIP_DEMO_STORIES=true` excludes `*.demo.stories.tsx`. Used by the Chromatic workflow because demo stories drive the homepage recording flow (xterm-heavy, animated) and would inflate visual baselines.

## No global decorator

`preview.tsx` deliberately does not declare a `decorators: [...]` array. Story files opt in to whatever context wrapper they need at the meta or story level (e.g. annotation's `withAppContext()` from `@contextbridge/annotation/src/testHelpers/appContextDecorator.tsx`). This keeps the host package decoupled from any single consumer's context shape — a wrapper that makes sense for annotation's `AnnotationAppContext` should not silently wrap stories from packages whose context looks nothing like it.

## Tailwind + React compiler

`vite.config.ts` carries the Tailwind v4 plugin and the React Compiler babel plugin. `@storybook/react-vite` auto-detects and merges this config, so the preview build matches the production build of the consuming packages. If a story renders correctly in dev but breaks under Chromatic, suspect a compiler-bailout or a Tailwind `@source` scope that doesn't reach the story's import root.

## Demo recording

`packages/annotation/scripts/recordDemo.ts` spawns this package's Storybook dev server, drives the `Plan/App > FullDemo` story with Playwright, and writes the homepage video + poster into `packages/website/`. The script lives in annotation because the demo content does; only the spawn target sits here.

Root repo conventions still apply — see `../../AGENTS.md`.
