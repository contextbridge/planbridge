import { z } from 'zod';
import { instantFromString } from './time.ts';

export const inboxItemKindSchema = z.enum(['pull_request', 'issue']);
export type InboxItemKind = z.infer<typeof inboxItemKindSchema>;

export const inboxItemStateSchema = z.enum(['open', 'draft', 'merged', 'closed']);
export type InboxItemState = z.infer<typeof inboxItemStateSchema>;

// What the viewer needs to do about an item, in descending urgency. The first
// state is the inbound "someone is blocked on me" lane; the middle four are the
// outbound "my PR, ball is in my court" lane; the last two are quiet.
export const inboxActionStateSchema = z.enum([
  'needs_my_review',
  'changes_requested',
  'ci_failing',
  'conflicts',
  'ready_to_merge',
  'waiting_on_others',
  'assigned_issue',
]);
export type InboxActionState = z.infer<typeof inboxActionStateSchema>;

const isoInstantStringSchema = z
  .string()
  .trim()
  .nonempty()
  .refine(
    (value) => {
      try {
        instantFromString(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'must be a valid ISO-8601 instant string' },
  );

const githubUrlSchema = z
  .string()
  .trim()
  .nonempty()
  .url()
  .refine((value) => isGitHubHttpUrl(value), { message: 'must be a GitHub URL' });

export const inboxFiltersSchema = z.object({
  repositories: z.array(z.string().trim().nonempty()).optional(),
  kinds: z.array(inboxItemKindSchema).optional(),
  includeDrafts: z.boolean().optional(),
  includeDependabot: z.boolean().optional(),
});
export type InboxFilters = z.infer<typeof inboxFiltersSchema>;

export const inboxActorSchema = z.object({
  login: z.string().trim().nonempty(),
  name: z.string().trim().nonempty().optional(),
  url: githubUrlSchema.optional(),
});
export type InboxActor = z.infer<typeof inboxActorSchema>;

export const inboxLabelSchema = z.object({
  name: z.string().trim().nonempty(),
  color: z.string().trim().nonempty().optional(),
});
export type InboxLabel = z.infer<typeof inboxLabelSchema>;

export const inboxItemSchema = z.object({
  id: z.string().trim().nonempty(),
  nodeId: z.string().trim().nonempty(),
  number: z.number().int().positive(),
  kind: inboxItemKindSchema,
  title: z.string().trim().nonempty(),
  url: githubUrlSchema,
  repository: z.string().trim().nonempty(),
  owner: z.string().trim().nonempty(),
  state: inboxItemStateSchema,
  isDraft: z.boolean(),
  author: inboxActorSchema,
  assignees: z.array(inboxActorSchema).optional(),
  reviewRequests: z.array(inboxActorSchema).optional(),
  labels: z.array(inboxLabelSchema).optional(),
  createdAt: isoInstantStringSchema,
  updatedAt: isoInstantStringSchema,
  lastActivityAt: isoInstantStringSchema.optional(),
  mergedAt: isoInstantStringSchema.optional(),
  baseRefName: z.string().trim().nonempty().optional(),
  headRefName: z.string().trim().nonempty().optional(),
  reviewDecision: z.string().trim().nonempty().optional(),
  checksConclusion: z.string().trim().nonempty().optional(),
  actionState: inboxActionStateSchema,
});
export type InboxItem = z.infer<typeof inboxItemSchema>;

export const inboxSnapshotSchema = z.object({
  viewer: z.string().trim().nonempty(),
  generatedAt: isoInstantStringSchema,
  filters: inboxFiltersSchema,
  items: z.array(inboxItemSchema),
  warnings: z.array(z.string().trim().nonempty()).optional(),
});
export type InboxSnapshot = z.infer<typeof inboxSnapshotSchema>;

export const openInboxItemRequestSchema = z.object({
  url: githubUrlSchema,
});
export type OpenInboxItemRequest = z.infer<typeof openInboxItemRequestSchema>;

export const openInboxItemResponseSchema = z.object({
  opened: z.literal(true),
});
export type OpenInboxItemResponse = z.infer<typeof openInboxItemResponseSchema>;

export const inboxErrorPayloadSchema = z.object({
  error: z.object({
    code: z.string().trim().nonempty(),
    message: z.string().trim().nonempty(),
  }),
});
export type InboxErrorPayload = z.infer<typeof inboxErrorPayloadSchema>;

function isGitHubHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname === 'github.com';
  } catch {
    return false;
  }
}
