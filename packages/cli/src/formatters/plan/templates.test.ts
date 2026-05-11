import {
  annotationAnchor,
  annotationThread,
  commentMessage,
  globalThread,
  reviewer,
} from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { PLAN_TEMPLATES } from './templates.ts';

describe('PLAN_TEMPLATES (plan-flavored formatAgentResponse output)', () => {
  it('renders approved submissions as a short markdown confirmation', () => {
    const output = formatAgentResponse(PLAN_TEMPLATES, { status: 'approved', threads: [] }, 'unused plan source');

    expect(output).toMatchInlineSnapshot(`
"# Plan review: approved

The human reviewed this plan and approved it with no changes. Proceed to implement the plan as written — do not re-plan, re-summarize, or ask for further confirmation.
"
`);
  });

  it('renders changes requested with general feedback first and annotation source slices', () => {
    const planContent = [
      '# My plan',
      '',
      '## Approach',
      '',
      '- Step one.',
      '- Step two.',
      '- Step three.',
      '',
      '## Rollout',
      '',
      '- Stage A.',
      '- Stage B.',
    ].join('\n');

    const output = formatAgentResponse(
      PLAN_TEMPLATES,
      {
        status: 'changes_requested',
        threads: [
          annotationThread.build({
            id: 'thr_ann_multiline',
            subject: {
              kind: 'annotation',
              anchor: annotationAnchor.build({
                sourceLines: { start: 9, end: 12 },
                quote: { exact: '## Rollout\n\n- Stage A.\n- Stage B.', prefix: '', suffix: '' },
              }),
            },
            messages: [
              commentMessage.build({
                id: 'msg_ann_01',
                author: reviewer.build(),
                body: "Let's add Stage C.",
                createdAt: '2026-04-20T12:34:56.000Z',
              }),
              commentMessage.build({
                id: 'msg_ann_02',
                author: reviewer.build(),
                body: 'Reply: Agreed.',
                createdAt: '2026-04-20T12:35:56.000Z',
              }),
            ],
          }),
          globalThread.build({
            id: 'thr_global_01',
            messages: [
              commentMessage.build({
                id: 'msg_global_01',
                author: reviewer.build(),
                body: 'General guidance first.',
                createdAt: '2026-04-20T12:33:56.000Z',
              }),
            ],
          }),
          globalThread.build({
            id: 'thr_global_02',
            messages: [
              commentMessage.build({
                id: 'msg_global_02',
                author: reviewer.build(),
                body: 'Another global thread.',
                createdAt: '2026-04-20T12:36:56.000Z',
              }),
            ],
          }),
        ],
      },
      planContent,
    );

    expect(output).toMatchInlineSnapshot(`
"# Plan review: changes requested

The human reviewed this plan and **did not approve it**. You MUST revise the plan to address every comment below, then submit the revised plan for another review before starting any implementation work.

Rules:

- Address every comment — each is a required change, not a suggestion.
- Do not resubmit the same plan unchanged.
- Do not paraphrase the feedback into the plan as if it were already addressed; actually change the plan.
- Do not start implementing the plan until a subsequent review comes back approved.

## General feedback

> General guidance first.
> — human, 2026-04-20T12:33:56Z

> Another global thread.
> — human, 2026-04-20T12:36:56Z

## Annotation (lines 9–12)

The comment below applies to the following section of the plan:

\`\`\`\`md
## Rollout

- Stage A.
- Stage B.
\`\`\`\`

> Let's add Stage C.
> — human, 2026-04-20T12:34:56Z

> Reply: Agreed.
> — human, 2026-04-20T12:35:56Z
"
`);
  });

  it('renders single-line annotations with "line N" instead of a range', () => {
    const planContent = ['- Item one.', '- Item two with `code`.', '- Item three.'].join('\n');

    const output = formatAgentResponse(
      PLAN_TEMPLATES,
      {
        status: 'changes_requested',
        threads: [
          annotationThread.build({
            id: 'thr_ann_single',
            subject: {
              kind: 'annotation',
              anchor: annotationAnchor.build({
                sourceLines: { start: 2, end: 2 },
                quote: { exact: 'code', prefix: 'Item two with ', suffix: '.' },
              }),
            },
            messages: [
              commentMessage.build({
                id: 'msg_single',
                author: reviewer.build(),
                body: 'Reword this bullet.',
                createdAt: '2026-04-20T12:40:00.000Z',
              }),
            ],
          }),
        ],
      },
      planContent,
    );

    expect(output).toContain('## Annotation (line 2)');
    expect(output).toContain('- Item two with `code`.');
    expect(output).toContain('Within that section, the reviewer specifically highlighted: `code`');
    expect(output).not.toContain('- Item one.');
    expect(output).not.toContain('- Item three.');
  });

  it('omits the highlighted call-out when the exact selection spans multiple lines', () => {
    const planContent = ['first line', 'second line', 'third line'].join('\n');

    const output = formatAgentResponse(
      PLAN_TEMPLATES,
      {
        status: 'changes_requested',
        threads: [
          annotationThread.build({
            id: 'thr_ann_multiline_exact',
            subject: {
              kind: 'annotation',
              anchor: annotationAnchor.build({
                sourceLines: { start: 1, end: 3 },
                quote: { exact: 'first line\nsecond line\nthird line', prefix: '', suffix: '' },
              }),
            },
            messages: [
              commentMessage.build({
                id: 'msg_multiline_exact',
                author: reviewer.build(),
                body: 'Everything.',
                createdAt: '2026-04-20T12:50:00.000Z',
              }),
            ],
          }),
        ],
      },
      planContent,
    );

    expect(output).not.toContain('Within that section, the reviewer specifically highlighted');
  });
});
