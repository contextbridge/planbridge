import { z } from 'zod';

export const ChannelSchema = z.enum(['stable', 'alpha']);
export type Channel = z.infer<typeof ChannelSchema>;

export const UpdateNoticeSchema = z.object({
  currentVersion: z.string().nonempty(),
  latestVersion: z.string().nonempty(),
  channel: ChannelSchema,
});

export type UpdateNotice = z.infer<typeof UpdateNoticeSchema>;
