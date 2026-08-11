# Bun testing conventions

Conventions specific to `bun:test` that are non-obvious and have bitten us. Scoped to packages that use Bun's test runner — the browser-UI packages (`@contextbridge/annotation`, `@contextbridge/review`) use vitest and these rules don't apply there.

Root repo testing conventions (colocated `.test.ts`, no `__tests__/`, fishery factories, component-local `testIds`, etc.) live in `AGENTS.md`. Add to this file when a **Bun-runtime-specific** pattern needs locking in.

## `.rejects` / `.resolves` matchers are synchronous — don't `await`, don't `async`, don't `nextTick`

`expect(promise).rejects.toX()` and `expect(promise).resolves.toX()` **block synchronously at runtime** via `globalThis.bunVM().waitForPromise(...)`. `bun-types` types them as returning `void` — the types are wrong and [upstream closed the fix as "not planned"](https://github.com/oven-sh/bun/issues/15457).

**Correct pattern:**

```ts
it('rejects on X', () => {
  expect(fn(...)).rejects.toBeInstanceOf(SomeError);
  expect(io.stderr.text()).toContain('expected message');
});
```

No `async`, no `await`, no manual `nextTick` flush.

**Why:** adapting Jest habits to Bun produces an antagonistic lint/TS pair:

- With `await expect(...).rejects.toX()` → TS80007 "`await` has no effect on the type of this expression" (the matcher is typed `void`).
- Without `await` → `@typescript-eslint/require-await` flags `async` as pointless.

Dropping both resolves both. The matcher still works — it already blocks the thread.

**`nextTick` is also unnecessary.** Some older tests have:

```ts
// CARGO-CULT — DO NOT COPY
it('rejects on X', async () => {
  expect(fn(...)).rejects.toBeInstanceOf(SomeError);
  await nextTick();
  expect(readErrorLogs(logs).some(...)).toBe(true);
});
```

That helper is a leftover from Jest patterns. `waitForPromise` already settled the promise, and `MemoryStream._write` (used by `FakeIo` and the pino log stream) is synchronous — stream-backed reads (`io.stderr.text()`, `readLogs(logs)`) are ready immediately on the next line. Verified empirically on `bun` 1.3.13 / `bun-types` 1.3.12: a 200-iteration probe of a `.rejects.toBeInstanceOf` + `io.stderr.text()` chain with no `async`/`await`/`nextTick` passed all 200.

**Keep `async` only when the body has a real `await`** — e.g. `await runHandler(ctx)` on a happy path, or async fixture setup. Don't keep it "just in case."

**Don't try to patch the types.** `Matchers.resolves` / `Matchers.rejects` are typed as property accessors on an interface; TS declaration merging can only add, not override. A local wrapper helper would work, but Bun's synchronous behavior makes it unnecessary.
