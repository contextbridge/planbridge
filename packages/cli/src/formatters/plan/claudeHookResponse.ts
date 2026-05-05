import type { PermissionRequestHookSpecificOutput } from '@anthropic-ai/claude-agent-sdk';
import type { PlanReviewSubmission } from '@contextbridge/shared/planReviewSchema';
import { formatAsMarkdown } from './markdown.ts';

export interface ClaudeHookResponse {
  hookSpecificOutput: PermissionRequestHookSpecificOutput;
}

export function claudeHookResponse(submission: PlanReviewSubmission, planContent: string): ClaudeHookResponse {
  if (submission.status === 'approved') {
    // setMode → acceptEdits is what actually exits plan mode for the session.
    // Without it, the allow only grants this ExitPlanMode call — the session
    // stays in `plan` and the agent can't touch the filesystem on its next turn.
    return {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'allow',
          updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }],
        },
      },
    };
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'deny', message: formatAsMarkdown(submission, planContent) },
    },
  };
}
