import assert from 'node:assert';
import type { ResultAsync } from 'neverthrow';

export async function expectOk<T, E>(resultAsync: ResultAsync<T, E>): Promise<T> {
  const result = await resultAsync;
  assert(result.isOk(), `expected Ok, got Err: ${String(result.isErr() ? result.error : '<unknown>')}`);
  return result.value;
}

export async function expectOkValue<T, E>(resultAsync: ResultAsync<T, E>): Promise<T> {
  return expectOk(resultAsync);
}

export async function expectErr<T, E>(resultAsync: ResultAsync<T, E>): Promise<E> {
  const result = await resultAsync;
  assert(result.isErr(), `expected Err, got Ok: ${String(result.isOk() ? result.value : '<unknown>')}`);
  return result.error;
}
