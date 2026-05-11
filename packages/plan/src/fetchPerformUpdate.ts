import type { Fetcher } from '@contextbridge/context';
import { type PerformUpdateResult, PerformUpdateResultSchema } from '@contextbridge/shared/performUpdateResultSchema';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';

const FALLBACK_ERROR: PerformUpdateResult = { status: 'error', message: 'Failed to reach update service.' };

export async function fetchPerformUpdate(fetcher: Fetcher): Promise<PerformUpdateResult> {
  return ResultAsync.fromPromise(fetcher.fetch('/perform-update', { method: 'POST' }), () => FALLBACK_ERROR)
    .andThen((response) =>
      response.ok
        ? ResultAsync.fromPromise(response.json() as Promise<unknown>, () => FALLBACK_ERROR)
        : errAsync(FALLBACK_ERROR),
    )
    .andThen((body) => {
      const parsed = PerformUpdateResultSchema.safeParse(body);
      return parsed.success ? okAsync(parsed.data) : errAsync(FALLBACK_ERROR);
    })
    .unwrapOr(FALLBACK_ERROR);
}
