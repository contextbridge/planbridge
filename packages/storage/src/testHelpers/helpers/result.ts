import { getErrorMessage } from '@contextbridge/shared/errors';
import { expect } from 'bun:test';
import type { Result } from 'neverthrow';

export function expectOk<T, E>(result: Result<T, E>): T {
  expect(result.isOk()).toBe(true);
  if (result.isErr()) throw new Error(getErrorMessage(result.error), { cause: result.error });
  return result.value;
}
