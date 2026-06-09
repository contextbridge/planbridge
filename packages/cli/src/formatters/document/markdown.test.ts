import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { annotationAnchor, annotationThread, commentMessage, globalThread } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { DOCUMENT_TEMPLATES } from './templates.ts';

describe('formatAgentResponse with DOCUMENT_TEMPLATES', () => {
  const content = `# Heading

Some paragraph.

Another paragraph.
`;

  it('renders approved with no annotations and no sourcePath', () => {
    const submission: AnnotationSubmission = { status: 'approved', threads: [] };
    const output = formatAgentResponse(DOCUMENT_TEMPLATES, submission, content);
    expect(output).toContain('# Review submitted');
    expect(output).toContain('the content');
    expect(output).toContain('no annotations');
    expect(output).not.toContain('`'); // No backticked path
  });

  it('renders approved with sourcePath', () => {
    const submission: AnnotationSubmission = { status: 'approved', threads: [] };
    const output = formatAgentResponse(DOCUMENT_TEMPLATES, submission, content, { sourcePath: '/abs/doc.md' });
    expect(output).toContain('`/abs/doc.md`');
    expect(output).toContain('no annotations');
  });

  it('renders changes_requested with a general feedback thread', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [globalThread.build({ messages: [commentMessage.build({ body: 'Please clarify section 2.' })] })],
    };
    const output = formatAgentResponse(DOCUMENT_TEMPLATES, submission, content);
    expect(output).toContain('# Review submitted');
    expect(output).toContain('the following comments');
    expect(output).toContain('## General feedback');
    expect(output).toContain('Please clarify section 2.');
  });

  it('renders changes_requested with an annotation thread (single line)', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 1, end: 1 },
              quote: { exact: 'Heading', prefix: '# ', suffix: '\n' },
            }),
          },
          messages: [commentMessage.build({ body: 'Title is too generic.' })],
        }),
      ],
    };
    const output = formatAgentResponse(DOCUMENT_TEMPLATES, submission, content);
    expect(output).toContain('## Comment (line 1)');
    expect(output).toContain('Within that section, the reviewer commented on the highlighted text: `Heading`');
    expect(output).toContain('Title is too generic.');
  });

  it('renders changes_requested with a multi-line annotation (no highlight)', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 3, end: 5 },
              quote: { exact: 'Some paragraph.\n\nAnother paragraph.', prefix: '\n', suffix: '\n' },
            }),
          },
          messages: [commentMessage.build({ body: 'Tighten these two paragraphs.' })],
        }),
      ],
    };
    const output = formatAgentResponse(DOCUMENT_TEMPLATES, submission, content);
    expect(output).toContain('## Comment (lines 3–5)');
    expect(output).not.toContain('commented on'); // multi-line skips the inline-code call-out
    expect(output).toContain('Tighten these two paragraphs.');
  });

  it('renders changes_requested with both general feedback and annotations', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [
        globalThread.build({ messages: [commentMessage.build({ body: 'Overall tone is off.' })] }),
        annotationThread.build({
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 1, end: 1 },
              quote: { exact: 'Heading', prefix: '# ', suffix: '\n' },
            }),
          },
          messages: [commentMessage.build({ body: 'Rewrite this line.' })],
        }),
      ],
    };
    const output = formatAgentResponse(DOCUMENT_TEMPLATES, submission, content);
    expect(output).toContain('## General feedback');
    expect(output).toContain('Overall tone is off.');
    expect(output).toContain('## Comment (line 1)');
    expect(output).toContain('Rewrite this line.');
  });

  it('renders changes_requested with sourcePath in the header', () => {
    const submission: AnnotationSubmission = {
      status: 'changes_requested',
      threads: [globalThread.build({ messages: [commentMessage.build({ body: 'A note.' })] })],
    };
    const output = formatAgentResponse(DOCUMENT_TEMPLATES, submission, content, { sourcePath: '/abs/draft.md' });
    expect(output).toContain('`/abs/draft.md`');
  });
});
