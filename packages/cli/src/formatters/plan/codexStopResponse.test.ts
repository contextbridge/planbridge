import {
  annotationAnchor,
  annotationThread,
  commentMessage,
  planReviewSubmission,
  reviewer,
} from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { codexStopResponse } from './codexStopResponse.ts';
import { formatAsMarkdown } from './markdown.ts';

describe('codexStopResponse', () => {
  it('returns null when the review is approved so Codex uses its native Plan Mode approval flow', () => {
    const submission = planReviewSubmission.build({ status: 'approved', threads: [] });
    const planContent = '# ignored\n';

    expect(codexStopResponse(submission, planContent)).toBe(null);
  });

  it('returns a block continuation whose reason matches formatAsMarkdown for changes-requested submissions', () => {
    const planContent = ['# Plan', '', '## Step one', '', '- do the thing'].join('\n');
    const submission = planReviewSubmission.build({
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_ann_01',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 5, end: 5 },
              quote: { exact: '- do the thing', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_ann_01',
              author: reviewer.build(),
              body: 'Tighten this.',
              createdAt: '2026-04-20T12:34:56.000Z',
            }),
          ],
        }),
      ],
    });

    const response = codexStopResponse(submission, planContent);

    expect(response).toEqual({
      decision: 'block',
      reason: formatAsMarkdown(submission, planContent),
    });
  });
});
