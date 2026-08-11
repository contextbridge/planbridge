import { z } from 'zod';
import { SettingsSchema } from './settingsSchema.ts';

/**
 * Wire contract between the CLI and the plan-review browser UI.
 *
 * The CLI hosts this at `GET /config` on its ephemeral review server so the
 * browser's instrumentation can initialize with the same `distinctId` the CLI
 * uses — the two halves of a single session share identity in PostHog — and
 * honor the CLI's already-resolved telemetry disabled decision.
 */
export const FrontendConfigSchema = z.object({
  distinctId: z.string().nonempty(),
  telemetryDisabled: z.boolean(),
  settings: SettingsSchema,
});

export type FrontendConfig = z.infer<typeof FrontendConfigSchema>;
