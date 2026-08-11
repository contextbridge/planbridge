import { type Settings, type SettingsPatch, resolveSettings } from '@contextbridge/shared/settingsSchema';
import type { SettingsStore, SettingsStoreError } from '@contextbridge/shared/settingsStore';
import { type Result, err, ok } from 'neverthrow';

export class FakeSettingsStore implements SettingsStore {
  settings: Settings = resolveSettings();
  readError: SettingsStoreError | undefined;
  readonly patches: SettingsPatch[] = [];

  read(): Promise<Result<Settings, SettingsStoreError>> {
    return Promise.resolve(this.readError ? err(this.readError) : ok(this.settings));
  }

  patch(patch: SettingsPatch): Promise<Result<Settings, SettingsStoreError>> {
    this.patches.push(patch);
    if (patch.ui?.theme !== undefined) {
      this.settings = { ...this.settings, ui: { ...this.settings.ui, theme: patch.ui.theme } };
    }
    return Promise.resolve(ok(this.settings));
  }
}
