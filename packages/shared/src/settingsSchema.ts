import type { HarnessId } from '@contextbridge/harness';
import { z } from 'zod';
import { ThemePreferenceSchema } from './themeSchema.ts';

export const CURRENT_SETTINGS_VERSION = 1 as const;

const uiSettingsShape = {
  theme: ThemePreferenceSchema,
} as const;
const harnessSettingsShape = {} satisfies Partial<Record<HarnessId, z.ZodType>>;

/**
 * The on-disk settings document. Sparse: only keys the user explicitly set
 * are written. Frozen once version 2 ships; migrate instead of editing.
 */
export const PersistedSettingsSchema = z.strictObject({
  version: z.literal(CURRENT_SETTINGS_VERSION),
  ui: z.strictObject(uiSettingsShape).partial().optional(),
  harnesses: z.strictObject(harnessSettingsShape).optional(),
});
export type PersistedSettings = z.infer<typeof PersistedSettingsSchema>;

/** A settings update sent from the browser UI to the CLI. */
export const SettingsPatchSchema = z
  .strictObject({
    ui: z.strictObject(uiSettingsShape).partial(),
    harnesses: z.strictObject(harnessSettingsShape),
  })
  .partial();
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

/** Settings with every default applied. Consumers read this shape. */
export const SettingsSchema = z.strictObject({
  ui: z.strictObject(uiSettingsShape),
  harnesses: z.strictObject(harnessSettingsShape),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function resolveSettings(persisted?: PersistedSettings): Settings {
  const { theme = 'system' } = persisted?.ui ?? {};
  return {
    ui: { theme },
    harnesses: {},
  };
}
