import {
  annotationAnchor,
  annotationSubmission,
  annotationThread,
  commentMessage,
  globalThread,
  reviewer,
} from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { claudeHookResponse } from './claudeHookResponse.ts';
import { PLAN_TEMPLATES } from './templates.ts';

describe('claudeHookResponse', () => {
  it('returns an allow envelope that echoes tool_input and switches the session to acceptEdits for approved submissions', () => {
    const submission = annotationSubmission.build({ status: 'approved', threads: [] });
    const toolInput = {
      plan: '# ignored by approved template\n',
      planFilePath: '/home/user/.claude/plans/sample.md',
    };

    const response = claudeHookResponse(submission, toolInput);

    expect(response).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'allow',
          updatedInput: toolInput,
          updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }],
        },
      },
    });
  });

  it('switches the session to auto when the submission requests auto approval mode', () => {
    const submission = annotationSubmission.build({ status: 'approved', threads: [], approvalMode: 'auto' });
    const toolInput = {
      plan: '# ignored by approved template\n',
      planFilePath: '/home/user/.claude/plans/sample.md',
    };

    const response = claudeHookResponse(submission, toolInput);

    expect(response).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'allow',
          updatedInput: toolInput,
          updatedPermissions: [{ type: 'setMode', mode: 'auto', destination: 'session' }],
        },
      },
    });
  });

  it('returns a deny envelope whose message matches formatAgentResponse for changes-requested submissions', () => {
    const planContent = ['# Plan', '', '## Step one', '', '- do the thing', '- then the next thing'].join('\n');
    const submission = annotationSubmission.build({
      status: 'changes_requested',
      threads: [
        annotationThread.build({
          id: 'thr_ann_01',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 5, end: 6 },
              quote: { exact: '- do the thing\n- then the next thing', prefix: '', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_ann_01',
              author: reviewer.build(),
              body: 'Expand this step.',
              createdAt: '2026-04-20T12:34:56.000Z',
            }),
            commentMessage.build({
              id: 'msg_ann_02',
              author: reviewer.build(),
              body: 'Also add a rollback plan.',
              createdAt: '2026-04-20T12:35:56.000Z',
            }),
          ],
        }),
      ],
    });

    const response = claudeHookResponse(submission, { plan: planContent });
    const decision = response.hookSpecificOutput.decision;

    expect(response.hookSpecificOutput.hookEventName).toBe('PermissionRequest');
    expect(decision.behavior).toBe('deny');
    if (decision.behavior !== 'deny') throw new Error('expected deny');
    expect(decision.message).toBe(formatAgentResponse(PLAN_TEMPLATES, submission, planContent));
    expect(decision.message).not.toBe('');
  });

  it('preserves formatter output across mixed global + annotation threads', () => {
    const planContent = ['# Plan', '', '## Approach', '', '- Step one.', '- Step two.'].join('\n');
    const submission = annotationSubmission.build({
      status: 'changes_requested',
      threads: [
        globalThread.build({
          id: 'thr_global_01',
          messages: [
            commentMessage.build({
              id: 'msg_global_01',
              author: reviewer.build(),
              body: 'Tighten the rollout section.',
              createdAt: '2026-04-20T12:33:56.000Z',
            }),
          ],
        }),
        annotationThread.build({
          id: 'thr_ann_02',
          subject: {
            kind: 'annotation',
            anchor: annotationAnchor.build({
              sourceLines: { start: 5, end: 5 },
              quote: { exact: 'Step one.', prefix: '- ', suffix: '' },
            }),
          },
          messages: [
            commentMessage.build({
              id: 'msg_ann_03',
              author: reviewer.build(),
              body: 'Specify which systems.',
              createdAt: '2026-04-20T12:34:56.000Z',
            }),
          ],
        }),
      ],
    });

    const response = claudeHookResponse(submission, { plan: planContent });
    const decision = response.hookSpecificOutput.decision;
    if (decision.behavior !== 'deny') throw new Error('expected deny');

    expect(decision.message).toBe(formatAgentResponse(PLAN_TEMPLATES, submission, planContent));
    expect(decision.message).toContain('## General feedback');
    expect(decision.message).toContain('## Annotation (line 5)');
  });
});
