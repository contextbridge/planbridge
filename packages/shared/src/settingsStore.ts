import type { Result } from 'neverthrow';
import type { Settings, SettingsPatch } from './settingsSchema.ts';

export type SettingsStoreErrorKind = 'filesystem' | 'conflict';

export class SettingsStoreError extends Error {
  readonly kind: SettingsStoreErrorKind;

  constructor(kind: SettingsStoreErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SettingsStoreError';
    this.kind = kind;
  }
}

/**
 * Reads and writes the user's persisted settings. A missing file reads as
 * defaults — that is the normal first-run state — but both methods refuse
 * a file they do not understand.
 */
export interface SettingsStore {
  read(): Promise<Result<Settings, SettingsStoreError>>;
  patch(patch: SettingsPatch): Promise<Result<Settings, SettingsStoreError>>;
}
