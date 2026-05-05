# @contextbridge/ui — shared styling foundation

This package holds the styling foundation for every browser UI in planbridge (`packages/plan`, later `packages/review`, …). It exports:

- **`./styles.css`** — global stylesheet (Tailwind v4 + fonts + OKLCH color palette + shadcn CSS variables). Consumers import this exactly once from their entry.
- **`./lib/utils`** — `cn()` helper (clsx + tailwind-merge).
- **`./components/*`** — shared non-shadcn components (e.g. `Header`, `BrandMark`). Generic across review experiences; must not import per-experience context.
- **`./components/ui/*`** — shadcn components.

## Design system (mirrors sibling projects)

- **Style**: shadcn `new-york` + `neutral` base. Matches `contextbridge.github.io`.
- **Fonts**: three-font system.
  - **ESBuild** — brand wordmark only (utility-bar header). 4 weights × normal+italic × WOFF2+WOFF in `src/fonts/`. URLs in `styles.css` are **relative** (`./fonts/…`) so Vite inlines them into each consumer's single-file bundle — do not change them to absolute paths. Exposed as `var(--cb-font-brand)` and the `.font-brand` utility class. Do not use for prose or content headings.
  - **IBM Plex Sans** — prose + chrome (including content headings like `h1–h6`). Loaded via `@fontsource/ibm-plex-sans`. Exposed as `var(--cb-font-sans)`; applied to `html, body` so consumers inherit it automatically.
  - **IBM Plex Mono** — code blocks and inline code. Loaded via `@fontsource/ibm-plex-mono`. Exposed as `var(--cb-font-mono)` and the `.font-mono` utility class. Scope it to `pre`/`code` containers; do not apply to prose.
- **Headings inherit Plex Sans by default.** Keep ESBuild opt-in through `.font-brand` only.
- **Dark mode**: `@media (prefers-color-scheme: dark)` only. No `.dark` class, no toggle, no runtime theming JS. Browser UIs are spawned per session, so the OS setting is the contract.
- **Colors**: OKLCH palette from `contextbridge.github.io`. Brand accents (royal, violet, coral, tangerine, peach) plus the shadcn semantic tokens (primary, secondary, muted, accent, destructive, card, popover, sidebar, chart-1..5).
- **Tailwind v4**: CSS-based config via `@theme inline` in `styles.css`. **There is no `tailwind.config.{js,ts}` file and there should never be one.**

## How consumers wire this up

A consuming package (e.g. `packages/plan`) does five things:

1. **devDeps**: `tailwindcss` and `@tailwindcss/vite` (the Tailwind engine runs in the **consumer's** Vite build, not here).
2. **Dependency**: `"@contextbridge/ui": "workspace:*"`.
3. **Vite config**: add `tailwindcss()` to `plugins` alongside `react()` and `viteSingleFile()`.
4. **Entry file**: `import '@contextbridge/ui/styles.css';` at the top.
5. **Components**: `import { Button } from '@contextbridge/ui/components/ui/button';`.

## `@source` directive — do not remove

`styles.css` contains `@source "./components/**/*.{ts,tsx}";`. Tailwind v4's auto-detection **skips workspace packages resolved through node_modules symlinks**, so without this directive the shadcn component class list (`bg-primary`, `h-9`, etc.) never reaches the generated CSS and components render unstyled. Any new component directory under `src/components/` must be covered by this glob.

## Adding a new shadcn component

From this package's directory:

```
cd packages/ui && bun x shadcn@latest add <name>
```

Three known quirks need cleanup after every run:

1. **Literal `#src/` directory**: the shadcn CLI treats `#src/*` in `components.json` aliases as a literal path, not a Node subpath import. It writes the file to `packages/ui/#src/components/ui/<name>.tsx`. Move it and remove the stray dir:
   ```
   mv '#src/components/ui/<name>.tsx' src/components/ui/ && rm -rf '#src'
   ```
2. **Missing `.ts` extension in imports**: shadcn emits `import { cn } from "#src/lib/utils"` (no extension). The planbridge convention (see root `AGENTS.md` → "Imports") uses `#src/context.ts` style with the extension. Rewrite to `#src/lib/utils.ts`.
3. **Lint/format drift**: shadcn uses double quotes and its own import order. Run `bun run lint:fix` at the repo root to normalize.

After cleanup, run `bun run typecheck` here and `just verify` at the root.

## What NOT to put in this package

- **Per-experience components** (plan-specific cards, review-specific widgets). Those live in the consuming package. `@contextbridge/ui` holds only generic, cross-experience primitives.
- **Runtime theming logic** (`useTheme`, ThemeProvider, localStorage persistence). System preference is the contract; no toggles.
- **Marketing-site-only utilities** (`.glass`, `.hero-product-card`, `.section-dark`, MagicUI animations). `contextbridge.github.io` has those — the CLI UIs do not need them.
- **A `tailwind.config.{js,ts}` file**. Tailwind v4 is configured entirely via CSS (`@theme inline` in `styles.css`).
