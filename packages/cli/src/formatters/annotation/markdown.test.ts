import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import {
  annotationAnchor,
  annotationThread,
  commentMessage,
  elementAnnotationAnchor,
  globalThread,
  reviewer,
} from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import Handlebars from 'handlebars';
import { formatAgentResponse } from './markdown.ts';
import type { AnnotationTemplates } from './templates.ts';

describe('formatAgentResponse (annotation engine)', () => {
  it('renders the approved template when status is approved', () => {
    const submission: AnnotationSubmission = { status: 'approved', threads: [] };
    const result = formatAgentResponse(buildFakeTemplates(), submission, '# anything');
    expect(result).toBe('APPROVED-MARKER');
  });

  it('uses the changes-requested template when status is changes_requested', () => {
    const submission: AnnotationSubmission = { status: 'changes_requested', threads: [] };
    const result = formatAgentResponse(buildFakeTemplates(), submission, '# anything');
    expect(result).toContain('CHANGES-MARKER');
  });

  it('reads kind-specific copy entirely from the templates argument (no hardcoded plan strings)', () => {
    const submission: AnnotationSubmission = { status: 'approved', threads: [] };
    const result = formatAgentResponse(buildFakeTemplates(), submission, '# anything');
    expect(result).not.toContain('Plan');
    expect(result).not.toContain('plan');
  });

  it('renders mixed global and annotation threads using their respective section templates', () => {
    const content = ['line 1', 'line 2', 'line 3', 'line 4'].join('\n');
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        globalThread.build({
          id: 'thr_global_mixed',
          messages: [
            commentMessage.build({
              id: 'msg_global_mixed',
              author: reviewer.build(),
              body: 'Global feedback body.',
              createdAt: '2026-04-20T12:00:00.000Z',
            }),
          ],
        }),
        annotationThread.build({
          id: 'thr_ann_mixed',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 2, end: 2 },
              quote: { exact: 'line 2', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_ann_mixed',
              author: reviewer.build(),
              body: 'Annotation feedback body.',
              createdAt: '2026-04-20T12:01:00.000Z',
            }),
          ],
        }),
      ],
    };

    const result = formatAgentResponse(buildFakeTemplates(), submission, content);

    expect(result).toContain('GLOBAL-MARKER');
    expect(result).toContain('Global feedback body.');
    expect(result).toContain('ANNOTATION-MARKER');
    expect(result).toContain('Annotation feedback body.');
    // Global section comes before annotation section in the output.
    expect(result.indexOf('GLOBAL-MARKER')).toBeLessThan(result.indexOf('ANNOTATION-MARKER'));
  });

  it('slices the source by 1-indexed line range for multi-line annotations', () => {
    const content = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'].join('\n');
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_ann_slice_multi',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 3, end: 5 },
              quote: { exact: 'gamma\ndelta\nepsilon', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_slice_multi',
              author: reviewer.build(),
              body: 'Multi-line slice comment.',
              createdAt: '2026-04-20T12:00:00.000Z',
            }),
          ],
        }),
      ],
    };

    const result = formatAgentResponse(buildSourceSliceTemplates(), submission, content);

    expect(result).toContain('SOURCE-START<gamma\ndelta\nepsilon>SOURCE-END');
    expect(result).not.toContain('alpha');
    expect(result).not.toContain('beta');
    expect(result).not.toContain('zeta');
  });

  it('slices a single source line for single-line annotations', () => {
    const content = ['alpha', 'beta', 'gamma'].join('\n');
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_ann_slice_single',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 2, end: 2 },
              quote: { exact: 'beta', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_slice_single',
              author: reviewer.build(),
              body: 'Single-line slice comment.',
              createdAt: '2026-04-20T12:00:00.000Z',
            }),
          ],
        }),
      ],
    };

    const result = formatAgentResponse(buildSourceSliceTemplates(), submission, content);

    expect(result).toContain('SOURCE-START<beta>SOURCE-END');
    expect(result).not.toContain('alpha');
    expect(result).not.toContain('gamma');
  });

  it('formats single-line ranges as "line N"', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_ann_range_single',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 7, end: 7 },
              quote: { exact: 'only', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_range_single',
              author: reviewer.build(),
              body: 'Single-line range.',
              createdAt: '2026-04-20T12:00:00.000Z',
            }),
          ],
        }),
      ],
    };

    const result = formatAgentResponse(buildRangeTemplates(), submission, padToLine('only', 7));

    expect(result).toContain('RANGE<line 7>');
    expect(result).not.toContain('lines');
  });

  it('formats multi-line ranges as "lines N–M" using an en-dash', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_ann_range_multi',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 4, end: 9 },
              quote: { exact: 'line 4\nline 5', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_range_multi',
              author: reviewer.build(),
              body: 'Multi-line range.',
              createdAt: '2026-04-20T12:00:00.000Z',
            }),
          ],
        }),
      ],
    };

    const result = formatAgentResponse(buildRangeTemplates(), submission, padToLine('content', 9));

    // Note: U+2013 EN DASH between the numbers.
    expect(result).toContain('RANGE<lines 4–9>');
    // Guard against ASCII hyphen-minus regression.
    expect(result).not.toContain('lines 4-9');
  });

  it('describes a single-line text selection as "the highlighted text: <code>"', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_ann_highlight_single',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 1, end: 1 },
              quote: { exact: 'highlight-me', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_highlight_single',
              author: reviewer.build(),
              body: 'Highlight present.',
              createdAt: '2026-04-20T12:00:00.000Z',
            }),
          ],
        }),
      ],
    };

    const result = formatAgentResponse(buildHighlightedTemplates(), submission, 'highlight-me here');

    expect(result).toContain('HIGHLIGHTED<the highlighted text: `highlight-me`>');
  });

  it('omits the focus call-out (empty value) when the exact selection spans multiple lines', () => {
    const content = ['first line', 'second line'].join('\n');
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_ann_highlight_multi',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 1, end: 2 },
              quote: { exact: 'first line\nsecond line', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_highlight_multi',
              author: reviewer.build(),
              body: 'No highlight for multi-line.',
              createdAt: '2026-04-20T12:00:00.000Z',
            }),
          ],
        }),
      ],
    };

    const result = formatAgentResponse(buildHighlightedTemplates(), submission, content);

    expect(result).toContain('HIGHLIGHTED<>');
    expect(result).not.toMatch(/HIGHLIGHTED<.+>/);
  });

  it('describes an element-anchored node by its descriptor and label', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_el_node',
          subject: { kind: 'annotation', anchor: elementAnnotationAnchor.build() },
        }),
      ],
    };

    expect(formatAgentResponse(buildHighlightedTemplates(), submission, 'unused')).toContain(
      'HIGHLIGHTED<the diagram node: `Login`>',
    );
  });

  it('describes an element-anchored edge by its descriptor and label', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_el_edge',
          subject: {
            kind: 'annotation',
            anchor: elementAnnotationAnchor.build({
              element: { id: 'edge1', label: 'submits', descriptor: 'diagram edge' },
            }),
          },
        }),
      ],
    };

    expect(formatAgentResponse(buildHighlightedTemplates(), submission, 'unused')).toContain(
      'HIGHLIGHTED<the diagram edge: `submits`>',
    );
  });

  it('describes a whole-block element annotation by descriptor alone (no label)', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_el_block',
          subject: {
            kind: 'annotation',
            anchor: {
              kind: 'element',
              contentType: 'mermaid',
              blockTargetId: 'mermaid:5',
              sourceLines: { start: 5, end: 9 },
              element: { label: 'diagram', descriptor: 'diagram' },
            },
          },
        }),
      ],
    };

    const result = formatAgentResponse(buildHighlightedTemplates(), submission, 'unused');
    expect(result).toContain('HIGHLIGHTED<the diagram>');
    expect(result).not.toContain('the diagram:');
  });

  it('threads opts.sourcePath into the approved and changesRequested templates as `source`', () => {
    const captured: Array<{ name: string; data: Record<string, unknown> }> = [];
    const recordingTemplate =
      (name: string): Handlebars.TemplateDelegate<Record<string, unknown>> =>
      (data: Record<string, unknown>) => {
        captured.push({ name, data });
        return name;
      };

    const stubTemplates: AnnotationTemplates = {
      approved: recordingTemplate('approved'),
      changesRequested: recordingTemplate('changesRequested'),
      annotationSection: recordingTemplate('annotationSection'),
      generalFeedbackSection: recordingTemplate('generalFeedbackSection'),
    };

    formatAgentResponse(stubTemplates, { status: 'approved', threads: [] }, '# doc', { sourcePath: '/abs/doc.md' });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.name).toBe('approved');
    expect(captured[0]?.data).toEqual({ source: '/abs/doc.md' });
  });

  it('renders thread messages in chronological order regardless of input order', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        globalThread.build({
          id: 'thr_global_sort',
          messages: [
            commentMessage.build({
              id: 'msg_late',
              author: reviewer.build(),
              body: 'SECOND message body.',
              createdAt: '2026-04-20T12:05:00.000Z',
            }),
            commentMessage.build({
              id: 'msg_early',
              author: reviewer.build(),
              body: 'FIRST message body.',
              createdAt: '2026-04-20T12:00:00.000Z',
            }),
          ],
        }),
      ],
    };

    const result = formatAgentResponse(buildThreadEchoTemplates(), submission, 'unused');

    const firstIndex = result.indexOf('FIRST message body.');
    const secondIndex = result.indexOf('SECOND message body.');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(-1);
    expect(firstIndex).toBeLessThan(secondIndex);
  });
});

function buildFakeTemplates(): AnnotationTemplates {
  return {
    approved: Handlebars.compile('APPROVED-MARKER', { noEscape: true }),
    changesRequested: Handlebars.compile('CHANGES-MARKER\n{{body}}', { noEscape: true }),
    annotationSection: Handlebars.compile('ANNOTATION-MARKER {{range}} {{sourceSlice}} {{focus}}\n{{comments}}', {
      noEscape: true,
    }),
    generalFeedbackSection: Handlebars.compile('GLOBAL-MARKER\n{{comments}}', { noEscape: true }),
  };
}

function buildSourceSliceTemplates(): AnnotationTemplates {
  return {
    approved: Handlebars.compile('APPROVED', { noEscape: true }),
    changesRequested: Handlebars.compile('{{body}}', { noEscape: true }),
    annotationSection: Handlebars.compile('SOURCE-START<{{sourceSlice}}>SOURCE-END\n{{comments}}', { noEscape: true }),
    generalFeedbackSection: Handlebars.compile('{{comments}}', { noEscape: true }),
  };
}

function buildRangeTemplates(): AnnotationTemplates {
  return {
    approved: Handlebars.compile('APPROVED', { noEscape: true }),
    changesRequested: Handlebars.compile('{{body}}', { noEscape: true }),
    annotationSection: Handlebars.compile('RANGE<{{range}}>\n{{comments}}', { noEscape: true }),
    generalFeedbackSection: Handlebars.compile('{{comments}}', { noEscape: true }),
  };
}

function buildHighlightedTemplates(): AnnotationTemplates {
  return {
    approved: Handlebars.compile('APPROVED', { noEscape: true }),
    changesRequested: Handlebars.compile('{{body}}', { noEscape: true }),
    annotationSection: Handlebars.compile('HIGHLIGHTED<{{focus}}>\n{{comments}}', { noEscape: true }),
    generalFeedbackSection: Handlebars.compile('{{comments}}', { noEscape: true }),
  };
}

function buildThreadEchoTemplates(): AnnotationTemplates {
  return {
    approved: Handlebars.compile('APPROVED', { noEscape: true }),
    changesRequested: Handlebars.compile('{{body}}', { noEscape: true }),
    annotationSection: Handlebars.compile('ANNOTATION\n{{comments}}', { noEscape: true }),
    generalFeedbackSection: Handlebars.compile('GLOBAL\n{{comments}}', { noEscape: true }),
  };
}

function padToLine(value: string, line: number): string {
  const filler = Array.from({ length: line - 1 }, (_, index) => `filler-${index + 1}`);
  return [...filler, value].join('\n');
}
