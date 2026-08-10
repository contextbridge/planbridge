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
 * Reads and writes the user's persisted settings. `read` falls back to
 * defaults instead of failing; `patch` refuses to rewrite a file it does
 * not understand.
 */
export interface SettingsStore {
  read(): Promise<Settings>;
  patch(patch: SettingsPatch): Promise<Result<Settings, SettingsStoreError>>;
}
