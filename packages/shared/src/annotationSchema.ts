import { z } from 'zod';
import { instantFromString } from './time.ts';

export const AnnotationStatusSchema = z.enum(['approved', 'changes_requested']);
export type AnnotationStatus = z.infer<typeof AnnotationStatusSchema>;

export const TextQuoteSelectorSchema = z.object({
  exact: z.string().nonempty(),
  prefix: z.string(),
  suffix: z.string(),
});
export type TextQuoteSelector = z.infer<typeof TextQuoteSelectorSchema>;

export const TextPositionSelectorSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .refine((value) => value.end >= value.start, {
    message: 'end must be greater than or equal to start',
    path: ['end'],
  });
export type TextPositionSelector = z.infer<typeof TextPositionSelectorSchema>;

export const TextEndpointSchema = z.object({
  targetId: z.string().nonempty(),
  offset: z.number().int().nonnegative(),
});
export type TextEndpoint = z.infer<typeof TextEndpointSchema>;

export const AnnotationTargetKindSchema = z.enum([
  'block',
  'inline',
  'list-item',
  'table-cell',
  'table-row',
  'table',
  'code-block',
]);
export type AnnotationTargetKind = z.infer<typeof AnnotationTargetKindSchema>;

export const AnnotationTargetSnapshotSchema = z.object({
  id: z.string().nonempty(),
  kind: AnnotationTargetKindSchema,
  label: z.string().nonempty(),
});
export type AnnotationTargetSnapshot = z.infer<typeof AnnotationTargetSnapshotSchema>;

export const SourceLineRangeSchema = z
  .object({
    start: z.number().int().positive(),
    end: z.number().int().positive(),
  })
  .refine((value) => value.end >= value.start, { message: 'end must be >= start' });
export type SourceLineRange = z.infer<typeof SourceLineRangeSchema>;

export const StoredAnnotationAnchorSchema = z.object({
  createdFrom: z.enum(['drag', 'element']),
  sourceLines: SourceLineRangeSchema,
  quote: TextQuoteSelectorSchema,
  position: TextPositionSelectorSchema,
  endpoints: z.object({
    start: TextEndpointSchema,
    end: TextEndpointSchema,
  }),
  target: AnnotationTargetSnapshotSchema.optional(),
  snapshot: z.object({
    targetText: z.string().nonempty(),
    blockText: z.string().nonempty().optional(),
  }),
});
export type StoredAnnotationAnchor = z.infer<typeof StoredAnnotationAnchorSchema>;

export const CommentAuthorSchema = z.object({
  id: z.string().nonempty(),
  kind: z.enum(['human', 'agent']),
  displayName: z.string().trim().nonempty(),
});
export type CommentAuthor = z.infer<typeof CommentAuthorSchema>;

export const IsoInstantStringSchema = z
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
export type IsoInstantString = z.infer<typeof IsoInstantStringSchema>;

export const CommentMessageSchema = z.object({
  id: z.string().nonempty(),
  author: CommentAuthorSchema,
  body: z.string().trim().nonempty(),
  createdAt: IsoInstantStringSchema,
});
export type CommentMessage = z.infer<typeof CommentMessageSchema>;

export const CommentThreadSubjectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('global'),
  }),
  z.object({
    kind: z.literal('annotation'),
    anchor: StoredAnnotationAnchorSchema,
  }),
]);
export type CommentThreadSubject = z.infer<typeof CommentThreadSubjectSchema>;

export const CommentThreadSchema = z.object({
  id: z.string().nonempty(),
  subject: CommentThreadSubjectSchema,
  messages: z.array(CommentMessageSchema).nonempty(),
});
export type CommentThread = z.infer<typeof CommentThreadSchema>;

export const AnnotationSubmissionSchema = z.object({
  status: AnnotationStatusSchema,
  threads: z.array(CommentThreadSchema).default([]),
});
export type AnnotationSubmission = z.infer<typeof AnnotationSubmissionSchema>;

export const AnnotationEntrypointSchema = z.enum(['plan_command', 'hook_claude', 'hook_codex']);
export type AnnotationEntrypoint = z.infer<typeof AnnotationEntrypointSchema>;

export const AnnotationPayloadSchema = z.object({
  content: z.string(),
  title: z
    .string()
    .trim()
    .transform((title) => (title.length > 0 ? title : null))
    .nullish(),
  metadata: z
    .object({
      entrypoint: AnnotationEntrypointSchema,
    })
    .optional(),
});
export type AnnotationPayload = z.infer<typeof AnnotationPayloadSchema>;
