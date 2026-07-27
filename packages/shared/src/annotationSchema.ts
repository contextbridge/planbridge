import { z } from 'zod';
import { instantFromString } from './time.ts';

export const ContentKindSchema = z.enum(['plan', 'document']);
export type ContentKind = z.infer<typeof ContentKindSchema>;

export const AnnotationStatusSchema = z.enum(['approved', 'changes_requested']);
export type AnnotationStatus = z.infer<typeof AnnotationStatusSchema>;

// Must stay a subset of PermissionMode from @anthropic-ai/claude-agent-sdk.
export const ApprovalModeSchema = z.enum(['acceptEdits', 'auto']);
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>;

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

/**
 * A text-range annotation: anchored to a character selection and re-located on reload via the
 * quote / position / endpoint selectors. This is the original (and default) annotation
 * mechanism; see {@link ElementAnnotationAnchorSchema} for the element-anchored counterpart.
 */
export const TextAnnotationAnchorSchema = z.object({
  kind: z.literal('text'),
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
export type TextAnnotationAnchor = z.infer<typeof TextAnnotationAnchorSchema>;

/**
 * An annotation anchored to a rendered, non-text element (a diagram node, a chart bar, …),
 * located by stable id within its block — unlike {@link TextAnnotationAnchorSchema}, which is
 * re-located by text quote/position. Produced and consumed by the matching ElementAdapter in
 * `@contextbridge/annotation`; the rest of the engine (resolver, CLI, sidebar) treats it
 * generically via these fields, so a new content type needs no changes outside its adapter.
 */
export const ElementAnnotationAnchorSchema = z.object({
  kind: z.literal('element'),
  /** Adapter id, e.g. `'mermaid'`. Free string — the element-adapter registry is the source of truth, so adding a content type needs zero schema changes. */
  contentType: z.string().nonempty(),
  /** Stable id of the rendered block (`${contentType}:${startLine}`); re-finds the block after a reload. */
  blockTargetId: z.string().nonempty(),
  /** Source line span of the fenced block; drives the agent-readable source slice. */
  sourceLines: SourceLineRangeSchema,
  /** The annotated element within the block. */
  element: z.object({
    /** Stable id of the sub-element within the block. Absent ⇒ the annotation targets the whole block. */
    id: z.string().nonempty().optional(),
    /** Human-readable label of the target (node/edge text, or the block descriptor). */
    label: z.string().nonempty(),
    /** Agent-facing noun the adapter chose, e.g. `'diagram node'`, `'diagram edge'`, `'diagram'`. Drives CLI serialization. */
    descriptor: z.string().nonempty(),
  }),
});
export type ElementAnnotationAnchor = z.infer<typeof ElementAnnotationAnchorSchema>;

export const StoredAnnotationAnchorSchema = z.discriminatedUnion('kind', [
  TextAnnotationAnchorSchema,
  ElementAnnotationAnchorSchema,
]);
export type StoredAnnotationAnchor = z.infer<typeof StoredAnnotationAnchorSchema>;

export const CommentAuthorSchema = z.object({
  id: z.string().nonempty(),
  kind: z.enum(['user', 'agent']),
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
  approvalMode: ApprovalModeSchema.default('acceptEdits'),
});
export type AnnotationSubmission = z.infer<typeof AnnotationSubmissionSchema>;

export const AnnotationEntrypointSchema = z.enum(['plan_command', 'hook_claude', 'hook_codex', 'open_command']);
export type AnnotationEntrypoint = z.infer<typeof AnnotationEntrypointSchema>;

export const ASSET_FILE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp'] as const;
export const AssetFileExtensionSchema = z.enum(ASSET_FILE_EXTENSIONS);
export type AssetFileExtension = z.infer<typeof AssetFileExtensionSchema>;

export const ASSET_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/x-icon',
  'image/x-ms-bmp',
] as const;
export const AssetMimeTypeSchema = z.enum(ASSET_MIME_TYPES);
export type AssetMimeType = z.infer<typeof AssetMimeTypeSchema>;

export const AssetDataBase64Schema = z
  .string()
  .trim()
  .nonempty()
  .refine((value) => isStandardBase64(value), { message: 'must be standard base64-encoded asset data' });
export type AssetDataBase64 = z.infer<typeof AssetDataBase64Schema>;

export const AssetSchema = z.object({
  id: z.string().nonempty(),
  originalPath: z.string().nonempty(),
  mimeType: AssetMimeTypeSchema,
  dataBase64: AssetDataBase64Schema,
});
export type Asset = z.infer<typeof AssetSchema>;

export const AnnotationPayloadSchema = z.object({
  content: z.string(),
  title: z
    .string()
    .trim()
    .transform((title) => (title.length > 0 ? title : null))
    .nullish(),
  contentKind: ContentKindSchema,
  metadata: z
    .object({
      entrypoint: AnnotationEntrypointSchema,
      sourcePath: z.string().trim().nonempty().optional(),
    })
    .optional(),
  assets: z.array(AssetSchema).optional(),
});
export type AnnotationPayload = z.infer<typeof AnnotationPayloadSchema>;

function isStandardBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}
