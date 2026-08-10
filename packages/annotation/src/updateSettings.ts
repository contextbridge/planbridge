import type { Logger } from '@contextbridge/context/frontend';
import type { SettingsPatch } from '@contextbridge/shared/settingsSchema';
import { ResultAsync } from 'neverthrow';

export type UpdateSettings = (patch: SettingsPatch) => Promise<boolean>;

export interface CreateUpdateSettingsOptions {
  readonly logger: Pick<Logger, 'error'>;
  readonly fetcher?: typeof fetch;
}

/** Never rejects: resolves false when the patch did not persist. */
export function createUpdateSettings(options: CreateUpdateSettingsOptions): UpdateSettings {
  const { logger, fetcher = fetch } = options;

  return async (patch: SettingsPatch): Promise<boolean> => {
    const result = await ResultAsync.fromPromise(
      fetcher('/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),
      (cause) => cause,
    );

    if (result.isErr()) {
      logger.error({ err: result.error, patch }, 'POST /settings never reached the review server');
      return false;
    }
    const response = result.value;
    if (!response.ok) {
      const body = (await response.text().catch(() => '')).trim();
      logger.error({ status: response.status, body, patch }, 'the review server rejected the settings patch');
      return false;
    }
    return true;
  };
}
