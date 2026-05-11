import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
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
});

function buildFakeTemplates(): AnnotationTemplates {
  return {
    approved: Handlebars.compile('APPROVED-MARKER', { noEscape: true }),
    changesRequested: Handlebars.compile('CHANGES-MARKER\n{{body}}', { noEscape: true }),
    annotationSection: Handlebars.compile('ANNOTATION-MARKER {{range}} {{sourceSlice}} {{highlighted}}\n{{thread}}', {
      noEscape: true,
    }),
    generalFeedbackSection: Handlebars.compile('GLOBAL-MARKER\n{{threads}}', { noEscape: true }),
  };
}
