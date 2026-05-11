import type { Fetcher } from '@contextbridge/context';
import { type UpdateNotice, UpdateNoticeSchema } from '@contextbridge/shared/updateNoticeSchema';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';

export async function fetchUpdateNotice(fetcher: Fetcher): Promise<UpdateNotice | null> {
  return ResultAsync.fromPromise(fetcher.fetch('/update-notice'), () => null)
    .andThen((response) =>
      response.ok ? ResultAsync.fromPromise(response.json() as Promise<unknown>, () => null) : errAsync(null),
    )
    .andThen((body) => {
      const parsed = UpdateNoticeSchema.safeParse(body);
      return parsed.success ? okAsync(parsed.data) : errAsync(null);
    })
    .unwrapOr(null);
}
