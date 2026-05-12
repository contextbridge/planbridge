import { z } from 'zod';

export const UpdateOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success') }),
  z.object({
    status: z.literal('failed'),
    message: z.string().trim().nonempty(),
    recoverable: z.boolean(),
  }),
]);

export type UpdateOutcome = z.infer<typeof UpdateOutcomeSchema>;
