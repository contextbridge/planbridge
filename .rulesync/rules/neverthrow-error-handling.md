---
root: false
targets: ["*"]
description: "neverthrow Result types for fallible I/O instead of scattered try/catch"
globs:
  - "packages/**/*.ts"
  - "packages/**/*.tsx"
---
# Neverthrow error handling

Fallible operations return `Result<T, E>` (from `neverthrow`) instead of throwing. Callers
handle the error path explicitly.

## Wrap fallible I/O at the boundary

Use neverthrow's `fromThrowable` and `ResultAsync.fromPromise` to wrap operations that can
throw (file reads, JSON parsing, API calls) into Result types. This keeps error handling
explicit and chainable without try/catch blocks scattered through business logic. The
pattern is used for fire-and-forget analytics, filesystem access, JSON parsing, and
transcript reads.

```typescript
import { fromThrowable } from 'neverthrow';
import { Result } from 'neverthrow';

const safeRead = fromThrowable((path: string) => readFileSync(path, 'utf8').trim());
const existing = safeRead(path).unwrapOr('');

export const safeJsonParse = Result.fromThrowable((text: string) => JSON.parse(text) as unknown, toError);
```

## Prefer combinators over manual `isErr()` checks

Chain the pipeline with combinators — `.andThen()` / `.map()` / `.mapErr()` / `.orElse()` /
`.asyncAndThen()` — instead of awaiting each step and branching on `isErr()`. A long
sequence of `if (x.isErr()) return err(x.error)` is a smell: it's the manual expansion of
what `.andThen()` already does, and it grows the diff without adding logic. Let the error
short-circuit through the chain; only the `Ok` path stays in your callbacks.

```ts
// Good — one chain, error short-circuits automatically
private applyAndWrite(patch: SettingsPatch): ResultAsync<Settings, SettingsStoreError> {
  return this.readPersisted().andThen((persisted) => {
    const updated = applyPatch(persisted ?? emptyDocument(), patch);
    return this.writePersisted(updated).map(() => resolveSettings(updated));
  });
}

// Avoid — manual unwrap-and-rewrap at every step
const readResult = await this.readPersisted();
if (readResult.isErr()) return err(readResult.error);
const updated = applyPatch(readResult.value ?? emptyDocument(), patch);
const writeResult = await this.writePersisted(updated);
if (writeResult.isErr()) return err(writeResult.error);
// ...
```

Mechanics:

- Return `ResultAsync<T, E>` directly from async fallible functions (it's awaitable to
  `Result<T, E>`, so callers can still `await` + `isErr()`). Synchronous functions
  return `Result<T, E>`.
- Bridge sync→async with `.asyncAndThen()`; a `Result` from a parser or zod check flows
  straight into an async chain without an intermediate `await`.
- Wrap a throwing promise with `ResultAsync.fromPromise(promise, toError)`. Wrap a
  `Promise<Result<…>>` (an already-fallible async API) with `new ResultAsync(promise)` so
  it joins the chain without double-wrapping.
- Inside an `.andThen()` callback you may return a plain `Result` (`ok(...)` / `err(...)`)
  or another `ResultAsync` — mix freely. Short imperative guards (a validation `for` loop
  returning `err(...)`) are fine *inside* a callback; the win is not re-checking the
  surrounding pipeline by hand.
- Use `.orElse()` for idempotent recovery — swallow expected conditions by returning
  `ok(...)` so the operation is retry-safe. Use `.mapErr()` only to log/translate.
- Keep try/catch + a `toError` normalizer for genuinely imperative code (pagination loops,
  `for await`).

`isErr()` propagation is still correct where a chain doesn't read better — but reach for it
as the exception, not the default.

## In tests, narrow with `assert`, never `_unsafeUnwrap`

Use `node:assert` to narrow the `Result` before reading `.value` / `.error`; it gives a
clear failure message and type narrowing. Never call `_unsafeUnwrap()` /
`_unsafeUnwrapErr()`.

```ts
import assert from 'node:assert';

const result = await store.patch({ ui: { theme: 'nord' } });
assert(result.isOk());
expect(result.value.ui.theme).toBe('nord');

const bad = await store.patch({ ui: { theme: 'nope' } });
assert(bad.isErr());
expect(bad.error.kind).toBe('conflict');
```
