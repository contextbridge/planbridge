import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'bun:test';
import {
  CURRENT_SETTINGS_VERSION,
  PersistedSettingsSchema,
  type Settings,
  SettingsPatchSchema,
  resolveSettings,
} from './settingsSchema.ts';

const fixturesDirectory = resolve(import.meta.dir, 'settingsFixtures');

// Frozen on-disk documents from released binaries. Deliberately not built
// from the live schema: a breaking schema change must fail these strict
// parses and force a migration story before it can merge.
const frozenFixtures: ReadonlyArray<[fixture: string, expected: Settings]> = [
  ['v1.full.json', { ui: { theme: 'dracula' }, harnesses: {} }],
  ['v1.minimal.json', { ui: { theme: 'system' }, harnesses: {} }],
];

describe('settings schema', () => {
  it.each(frozenFixtures)('parses and resolves the frozen fixture %s', async (fixture, expected) => {
    const input = JSON.parse(await readFile(resolve(fixturesDirectory, fixture), 'utf8')) as unknown;
    expect(resolveSettings(PersistedSettingsSchema.parse(input))).toEqual(expected);
  });

  it('covers every fixture on disk', async () => {
    const onDisk = (await readdir(fixturesDirectory)).filter((name) => name.endsWith('.json')).sort();
    expect(onDisk).toEqual(frozenFixtures.map(([fixture]) => fixture));
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
