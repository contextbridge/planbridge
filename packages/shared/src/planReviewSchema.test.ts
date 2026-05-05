import { describe, expect, it } from 'bun:test';
import { PlanReviewSubmissionSchema, SubmissionPayloadSchema } from './planReviewSchema.ts';
import { annotationAnchor, annotationThread, commentMessage, globalThread } from './testFactories.ts';
import { Temporal, instantFromString, instantToString } from './time.ts';

describe('PlanReviewSubmissionSchema', () => {
  it('accepts an approval with no threads', () => {
    const parsed = PlanReviewSubmissionSchema.parse({ status: 'approved' });
    expect(parsed.status).toBe('approved');
    expect(parsed.threads).toEqual([]);
  });

  it('accepts an annotation thread with authored messages', () => {
    const parsed = PlanReviewSubmissionSchema.parse({
      status: 'changes_requested',
      threads: [annotationThread.build()],
    });

    expect(parsed.threads).toHaveLength(1);
    expect(parsed.threads[0]?.subject.kind).toBe('annotation');
    expect(parsed.threads[0]?.messages[0]?.author.id).toBe('local-user');
  });

  it('accepts a global thread', () => {
    const parsed = PlanReviewSubmissionSchema.parse({
      status: 'changes_requested',
      threads: [globalThread.build()],
    });

    expect(parsed.threads[0]?.subject.kind).toBe('global');
  });

  it('rejects a thread with no messages', () => {
    expect(() =>
      PlanReviewSubmissionSchema.parse({
        status: 'changes_requested',
        threads: [{ id: 'thr_01', subject: { kind: 'global' }, messages: [] }],
      }),
    ).toThrow();
  });

  it('rejects an invalid createdAt string', () => {
    expect(() =>
      PlanReviewSubmissionSchema.parse({
        status: 'changes_requested',
        threads: [annotationThread.build({ messages: [commentMessage.build({ createdAt: 'today' })] })],
      }),
    ).toThrow();
  });

  it('rejects a backwards position range', () => {
    expect(() =>
      PlanReviewSubmissionSchema.parse({
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

describe('SubmissionPayloadSchema', () => {
  it('accepts content with no metadata', () => {
    const parsed = SubmissionPayloadSchema.parse({ content: '# plan' });
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.title).toBeUndefined();
  });

  it('accepts content with source metadata', () => {
    const parsed = SubmissionPayloadSchema.parse({
      content: '# plan',
      metadata: { source: 'file' },
    });
    expect(parsed.metadata?.source).toBe('file');
  });

  it('accepts a title', () => {
    const parsed = SubmissionPayloadSchema.parse({ content: '# plan', title: '  plan  ' });
    expect(parsed.title).toBe('plan');
  });

  it('accepts a null title', () => {
    const parsed = SubmissionPayloadSchema.parse({ content: 'no heading', title: null });
    expect(parsed.title).toBeNull();
  });

  it('coalesces an empty title to null', () => {
    const parsed = SubmissionPayloadSchema.parse({ content: 'x', title: '' });
    expect(parsed.title).toBeNull();
  });

  it('coalesces a whitespace-only title to null', () => {
    const parsed = SubmissionPayloadSchema.parse({ content: 'x', title: '   ' });
    expect(parsed.title).toBeNull();
  });
});

describe('time helpers', () => {
  it('round-trips an instant string', () => {
    const instant = Temporal.Instant.from('2026-04-20T12:34:56.000Z');
    expect(instantFromString(instantToString(instant)).epochNanoseconds).toBe(instant.epochNanoseconds);
  });
});
