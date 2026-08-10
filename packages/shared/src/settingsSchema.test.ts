import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'bun:test';
import {
  CURRENT_SETTINGS_VERSION,
  PersistedSettingsSchema,
  SettingsPatchSchema,
  resolveSettings,
} from './settingsSchema.ts';

const fixturesDirectory = resolve(import.meta.dir, 'settingsFixtures');

describe('settings schema', () => {
  it('parses and resolves every frozen v1 fixture', async () => {
    const fixtures = (await readdir(fixturesDirectory)).filter((name) => name.endsWith('.json')).sort();
    expect(fixtures.length).toBeGreaterThan(0);

    for (const fixture of fixtures) {
      const input = JSON.parse(await readFile(resolve(fixturesDirectory, fixture), 'utf8')) as unknown;
      expect(resolveSettings(PersistedSettingsSchema.parse(input))).toMatchSnapshot(fixture);
    }
  });

  it('rejects unknown keys in patches and persisted documents', () => {
    expect(SettingsPatchSchema.safeParse({ ui: { future: true } }).success).toBe(false);
    expect(PersistedSettingsSchema.safeParse({ version: CURRENT_SETTINGS_VERSION, future: true }).success).toBe(false);
  });

  it('applies defaults for keys the persisted document does not set', () => {
    expect(resolveSettings()).toEqual({ ui: { theme: 'system' }, harnesses: {} });
    expect(resolveSettings({ version: CURRENT_SETTINGS_VERSION, ui: { theme: 'dracula' } })).toEqual({
      ui: { theme: 'dracula' },
      harnesses: {},
    });
  });
});
