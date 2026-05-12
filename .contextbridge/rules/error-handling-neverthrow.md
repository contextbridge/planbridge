---
paths: ["packages/**/*.ts", "packages/**/*.tsx"]
globs: ["packages/**/*.ts", "packages/**/*.tsx"]
---

# Error Handling Neverthrow

- **Use neverthrow for safe wrappers around fallible I/O.** The team uses neverthrow's \`fromThrowable\` and \`ResultAsync.fromPromise\` to wrap operations that can throw (file reads, JSON parsing, API calls) into Result types. This keeps error handling explicit and chainable without try/catch blocks scattered through business logic. The pattern is used for fire-and-forget analytics, filesystem access, JSON parsing, and transcript reads.

  **Good:**

  ```typescript
  import { fromThrowable } from 'neverthrow';
  import { Result } from 'neverthrow';

  const safeRead = fromThrowable((path: string) => readFileSync(path, 'utf8').trim());
  const existing = safeRead(path).unwrapOr('');

  export const safeJsonParse = Result.fromThrowable((text: string) => JSON.parse(text) as unknown, toError);
  ```
