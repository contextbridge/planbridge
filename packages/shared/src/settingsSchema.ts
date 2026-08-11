import type { HarnessId } from '@contextbridge/harness';
import { z } from 'zod';
import { ClaudePlanApprovalModeSchema } from './claudeSettingsSchema.ts';
import { ThemePreferenceSchema } from './themeSchema.ts';

export const CURRENT_SETTINGS_VERSION = 1 as const;

const uiSettings = {
  theme: ThemePreferenceSchema,
} as const;
const claudeSettings = {
  planApprovalMode: ClaudePlanApprovalModeSchema,
} as const;
const sparseHarnessSettings = {
  claude: z.strictObject(claudeSettings).partial(),
} satisfies Partial<Record<HarnessId, z.ZodType>>;
const resolvedHarnessSettings = {
  claude: z.strictObject(claudeSettings),
} satisfies Partial<Record<HarnessId, z.ZodType>>;

/**
 * The on-disk settings document. Sparse: only keys the user explicitly set
 * are written. Frozen once version 2 ships; migrate instead of editing.
 */
export const PersistedSettingsSchema = z.strictObject({
  version: z.literal(CURRENT_SETTINGS_VERSION),
  ui: z.strictObject(uiSettings).partial().optional(),
  harnesses: z.strictObject(sparseHarnessSettings).partial().optional(),
});
export type PersistedSettings = z.infer<typeof PersistedSettingsSchema>;

/** A settings update sent from the browser UI to the CLI. */
export const SettingsPatchSchema = z
  .strictObject({
    ui: z.strictObject(uiSettings).partial(),
    harnesses: z.strictObject(sparseHarnessSettings).partial(),
  })
  .partial();
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

/** Settings with every default applied. Consumers read this shape. */
export const SettingsSchema = z.strictObject({
  ui: z.strictObject(uiSettings),
  harnesses: z.strictObject(resolvedHarnessSettings),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function resolveSettings(persisted?: PersistedSettings): Settings {
  const { theme = 'system' } = persisted?.ui ?? {};
  const { planApprovalMode = 'auto' } = persisted?.harnesses?.claude ?? {};
  return {
    ui: { theme },
    harnesses: { claude: { planApprovalMode } },
  };
}
