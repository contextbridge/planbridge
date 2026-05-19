import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';

const UPDATE_NOTICE_TIMEOUT_MS = 3_000;

export type CheckForUpdate = () => Promise<UpdateNotice | null>;

export async function handleUpdateNotice(checkForUpdate: CheckForUpdate | undefined): Promise<Response> {
  const notice = await resolveUpdateNotice(checkForUpdate);
  return Response.json(notice);
}

async function resolveUpdateNotice(checkForUpdate: CheckForUpdate | undefined): Promise<UpdateNotice | null> {
  if (!checkForUpdate) return null;
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), UPDATE_NOTICE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve().then(checkForUpdate), timeout]);
  } catch {
    return null;
  }
}
