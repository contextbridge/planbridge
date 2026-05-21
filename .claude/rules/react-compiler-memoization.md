---
paths:
  - "packages/**/*.tsx"
  - "packages/**/src/**/*.ts"
---

# React Compiler memoization

This repo has `babel-plugin-react-compiler` enabled via `@vitejs/plugin-react` in every browser-UI package (see `packages/annotation/vite.config.ts`, `packages/review/vite.config.ts`). The compiler auto-memoizes; **do not write `useCallback` or `useMemo` manually** unless one of the narrow cases below applies. Manual memos are noise — more code, no behavior change.

Companion lint rules from `eslint-plugin-react-hooks` catch adjacent anti-patterns (`react-hooks/set-state-in-effect`, purity/mutation violations, bail-out cases). They do **not** flag redundant `useCallback` / `useMemo` — that's a write-time decision, which is why this rule exists.

## Keep `useCallback` / `useMemo` only when

1. **The value sits in a `useEffect` dep array** and `react-hooks/exhaustive-deps` fires without the memo. ESLint is a separate static analyzer and doesn't know the compiler exists; when it demands stable identity, keep the memo. Correctness, not perf.
2. **A value is passed across a boundary the compiler can't see** — e.g. into a Context provider consumed by code it didn't analyze, or a library that compares by identity. Rare in application code.

## Always delete

- `useMemo` for values derived from props or state that aren't in any effect's deps
- `useCallback` for event handlers passed as JSX props (`onClick`, `onSubmit`, etc.) — React doesn't compare handler identity
- `useCallback` / `useMemo` where the dep array lists the same things the body already closures over

## Not memoization (keep these)

- **`useRef` for "latest value" patterns** — a ref updated in an effect so event listeners can read the current value without re-binding. Correctness tool, not memoization.
- **`useRef` for imperative state** — counters, flags, DOM refs.

## Verifying

After deleting manual memos:

1. Run the build and watch for `react-compiler` bail-out warnings. If a file bails, restore the minimum memos needed for that file.
2. Run `bun run lint`. If `react-hooks/exhaustive-deps` flags an unstable effect dep, wrap it in `useCallback`. Don't silence the rule.
3. Run the tests. Behavior must not change.

## Skeptic check

Ask: "What correctness-relevant code compares this value by identity?" If the answer is "nothing" (just render output or handler props), delete the memo. If the answer is "this `useEffect`'s dep array," keep it.
