import { describe, expect, it } from 'bun:test';
import {
  ASSET_FILE_EXTENSIONS,
  ASSET_MIME_TYPES,
  AnnotationEntrypointSchema,
  AnnotationPayloadSchema,
  AnnotationSubmissionSchema,
  AssetFileExtensionSchema,
  AssetSchema,
  ContentKindSchema,
} from './annotationSchema.ts';
import { annotationAnchor, annotationThread, asset, commentMessage, globalThread } from './testFactories.ts';
import { Temporal, instantFromString, instantToString } from './time.ts';

describe('AnnotationSubmissionSchema', () => {
  it('accepts an approval with no threads', () => {
    const parsed = AnnotationSubmissionSchema.parse({ status: 'approved' });
    expect(parsed.status).toBe('approved');
    expect(parsed.threads).toEqual([]);
  });

  it('accepts an annotation thread with authored messages', () => {
    const parsed = AnnotationSubmissionSchema.parse({
      status: 'changes_requested',
      threads: [annotationThread.build()],
    });

    expect(parsed.threads).toHaveLength(1);
    expect(parsed.threads[0]?.subject.kind).toBe('annotation');
    expect(parsed.threads[0]?.messages[0]?.author.id).toBe('local-user');
  });

  it('accepts a global thread', () => {
    const parsed = AnnotationSubmissionSchema.parse({
      status: 'changes_requested',
      threads: [globalThread.build()],
    });

    expect(parsed.threads[0]?.subject.kind).toBe('global');
  });

  it('rejects a thread with no messages', () => {
    expect(() =>
      AnnotationSubmissionSchema.parse({
        status: 'changes_requested',
        threads: [{ id: 'thr_01', subject: { kind: 'global' }, messages: [] }],
      }),
    ).toThrow();
  });

  it('rejects an invalid createdAt string', () => {
    expect(() =>
      AnnotationSubmissionSchema.parse({
        status: 'changes_requested',
        threads: [annotationThread.build({ messages: [commentMessage.build({ createdAt: 'today' })] })],
      }),
    ).toThrow();
  });

  it('rejects a backwards position range', () => {
    expect(() =>
      AnnotationSubmissionSchema.parse({
        status: 'approved',
        threads: [
          annotationThread.build({
            subject: { kind: 'annotation', anchor: annotationAnchor.build({ position: { start: 10, end: 3 } }) },
          }),
        ],
      }),
    ).toThrow();
  });
});

describe('AnnotationPayloadSchema', () => {
  it('accepts content with no metadata', () => {
    const parsed = AnnotationPayloadSchema.parse({ content: '# plan', contentKind: 'plan' });
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.title).toBeUndefined();
  });

  it('accepts content with entrypoint metadata', () => {
    const parsed = AnnotationPayloadSchema.parse({
      content: '# plan',
      contentKind: 'plan',
      metadata: { entrypoint: 'plan_command' },
    });
    expect(parsed.metadata?.entrypoint).toBe('plan_command');
  });

  it('accepts hook_claude entrypoint metadata', () => {
    const parsed = AnnotationPayloadSchema.parse({
      content: '# plan',
      contentKind: 'plan',
      metadata: { entrypoint: 'hook_claude' },
    });
    expect(parsed.metadata?.entrypoint).toBe('hook_claude');
  });

  it('accepts hook_codex entrypoint metadata', () => {
    const parsed = AnnotationPayloadSchema.parse({
      content: '# plan',
      contentKind: 'plan',
      metadata: { entrypoint: 'hook_codex' },
    });
    expect(parsed.metadata?.entrypoint).toBe('hook_codex');
  });

  it('accepts a title', () => {
    const parsed = AnnotationPayloadSchema.parse({ content: '# plan', contentKind: 'plan', title: '  plan  ' });
    expect(parsed.title).toBe('plan');
  });

  it('accepts a null title', () => {
    const parsed = AnnotationPayloadSchema.parse({ content: 'no heading', contentKind: 'plan', title: null });
    expect(parsed.title).toBeNull();
  });

  it('coalesces an empty title to null', () => {
    const parsed = AnnotationPayloadSchema.parse({ content: 'x', contentKind: 'plan', title: '' });
    expect(parsed.title).toBeNull();
  });

  it('coalesces a whitespace-only title to null', () => {
    const parsed = AnnotationPayloadSchema.parse({ content: 'x', contentKind: 'plan', title: '   ' });
    expect(parsed.title).toBeNull();
  });

  it('rejects an unknown contentKind', () => {
    expect(() => AnnotationPayloadSchema.parse({ content: 'x', contentKind: 'file' })).toThrow();
  });

  it('rejects a missing contentKind', () => {
    expect(() => AnnotationPayloadSchema.parse({ content: 'x' })).toThrow();
  });

  it('accepts contentKind: document', () => {
    const parsed = AnnotationPayloadSchema.parse({ content: '# doc', contentKind: 'document' });
    expect(parsed.contentKind).toBe('document');
  });

  it('accepts open_command entrypoint metadata', () => {
    const parsed = AnnotationPayloadSchema.parse({
      content: '# doc',
      contentKind: 'document',
      metadata: { entrypoint: 'open_command' },
    });
    expect(parsed.metadata?.entrypoint).toBe('open_command');
  });

  it('accepts metadata.sourcePath', () => {
    const parsed = AnnotationPayloadSchema.parse({
      content: '# doc',
      contentKind: 'document',
      metadata: { entrypoint: 'open_command', sourcePath: '/abs/path/to/doc.md' },
    });
    expect(parsed.metadata?.sourcePath).toBe('/abs/path/to/doc.md');
  });

  it('rejects an empty sourcePath', () => {
    expect(() =>
      AnnotationPayloadSchema.parse({
        content: '# doc',
        contentKind: 'document',
        metadata: { entrypoint: 'open_command', sourcePath: '' },
      }),
    ).toThrow();
  });

  it('rejects a whitespace-only sourcePath', () => {
    expect(() =>
      AnnotationPayloadSchema.parse({
        content: '# doc',
        contentKind: 'document',
        metadata: { entrypoint: 'open_command', sourcePath: '   ' },
      }),
    ).toThrow();
  });
});

describe('AssetSchema', () => {
  it('parses a valid asset record', () => {
    const parsed = AssetSchema.parse(
      asset.build({ id: 'abc123', originalPath: '/Users/alice/diagram.png', dataBase64: 'iVBORw0KGgo=' }),
    );

    expect(parsed).toMatchObject({
      id: 'abc123',
      originalPath: '/Users/alice/diagram.png',
      mimeType: 'image/png',
      dataBase64: 'iVBORw0KGgo=',
    });
  });

  it('rejects an empty id', () => {
    expect(() => AssetSchema.parse(asset.build({ id: '' }))).toThrow();
  });

  it('rejects an empty originalPath', () => {
    expect(() => AssetSchema.parse(asset.build({ originalPath: '' }))).toThrow();
  });

  it('rejects an unsupported mime type', () => {
    expect(() =>
      AssetSchema.parse({ ...asset.build({ originalPath: '/x.svg' }), mimeType: 'image/svg+xml' }),
    ).toThrow();
  });

  it('rejects non-base64 asset data', () => {
    expect(() => AssetSchema.parse(asset.build({ dataBase64: 'not base64!' }))).toThrow();
  });

  it('accepts each allowed mime type', () => {
    for (const mimeType of ASSET_MIME_TYPES) {
      expect(() => AssetSchema.parse(asset.build({ mimeType }))).not.toThrow();
    }
  });
});

describe('AssetFileExtensionSchema', () => {
  it('accepts each allowed file extension', () => {
    for (const extension of ASSET_FILE_EXTENSIONS) {
      expect(AssetFileExtensionSchema.parse(extension)).toBe(extension);
    }
  });

  it('rejects svg files', () => {
    expect(() => AssetFileExtensionSchema.parse('.svg')).toThrow();
  });
});

describe('AnnotationPayloadSchema with assets', () => {
  it('accepts a payload with an optional assets array', () => {
    const parsed = AnnotationPayloadSchema.parse({
      content: '# plan',
      contentKind: 'plan',
      assets: [asset.build({ id: 'abc', originalPath: '/x.png' })],
    });
    expect(parsed.assets).toHaveLength(1);
  });

  it('accepts a payload with no assets field (backward compatible)', () => {
    const parsed = AnnotationPayloadSchema.parse({
      content: '# plan',
      contentKind: 'plan',
    });
    expect(parsed.assets).toBeUndefined();
  });
});

describe('ContentKindSchema', () => {
  it('parses plan', () => {
    expect(ContentKindSchema.parse('plan')).toBe('plan');
  });

  it('parses document', () => {
    expect(ContentKindSchema.parse('document')).toBe('document');
  });

  it('rejects unknown kinds', () => {
    expect(() => ContentKindSchema.parse('file')).toThrow();
  });
});

describe('AnnotationEntrypointSchema', () => {
  it('accepts plan_command', () => {
    expect(AnnotationEntrypointSchema.parse('plan_command')).toBe('plan_command');
  });

  it('accepts hook_claude', () => {
    expect(AnnotationEntrypointSchema.parse('hook_claude')).toBe('hook_claude');
  });

  it('accepts hook_codex', () => {
    expect(AnnotationEntrypointSchema.parse('hook_codex')).toBe('hook_codex');
  });

  it("rejects the old 'file' value", () => {
    expect(() => AnnotationEntrypointSchema.parse('file')).toThrow();
  });

  it("rejects the old 'stdin' value", () => {
    expect(() => AnnotationEntrypointSchema.parse('stdin')).toThrow();
  });
});

describe('time helpers', () => {
  it('round-trips an instant string', () => {
    const instant = Temporal.Instant.from('2026-04-20T12:34:56.000Z');
    expect(instantFromString(instantToString(instant)).epochNanoseconds).toBe(instant.epochNanoseconds);
  });
});
