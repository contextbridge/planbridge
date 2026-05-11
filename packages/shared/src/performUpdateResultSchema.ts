import { z } from 'zod';

/**
 * Wire-format schema for the result of a server-side `performUpdate` call.
 * The browser only needs to know whether the update succeeded and a
 * human-readable message — internal diagnostics stay server-side.
 */
export const PerformUpdateResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), message: z.string().nonempty() }),
  z.object({ status: z.literal('error'), message: z.string().nonempty() }),
]);

export type PerformUpdateResult = z.infer<typeof PerformUpdateResultSchema>;
