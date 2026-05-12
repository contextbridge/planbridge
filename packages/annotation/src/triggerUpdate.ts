import type { Fetcher } from '@contextbridge/context';
import { type UpdateOutcome, UpdateOutcomeSchema } from '@contextbridge/shared/updateOutcomeSchema';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';

const NETWORK_FAILURE: UpdateOutcome = {
  status: 'failed',
  message: 'Update request failed. Try running `contextbridge update` in your terminal.',
  recoverable: true,
};

export async function triggerUpdate(fetcher: Fetcher): Promise<UpdateOutcome> {
  return ResultAsync.fromPromise(fetcher.fetch('/update', { method: 'POST' }), () => NETWORK_FAILURE)
    .andThen((response) =>
      response.ok
        ? ResultAsync.fromPromise(response.json() as Promise<unknown>, () => NETWORK_FAILURE)
        : errAsync(NETWORK_FAILURE),
    )
    .andThen((body) => {
      const parsed = UpdateOutcomeSchema.safeParse(body);
      return parsed.success ? okAsync(parsed.data) : errAsync(NETWORK_FAILURE);
    })
    .unwrapOr(NETWORK_FAILURE);
}
