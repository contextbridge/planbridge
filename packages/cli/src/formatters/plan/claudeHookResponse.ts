import type { PermissionRequestHookSpecificOutput } from '@anthropic-ai/claude-agent-sdk';
import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { PLAN_TEMPLATES } from './templates.ts';

export interface ClaudeHookResponse {
  hookSpecificOutput: PermissionRequestHookSpecificOutput;
}

export interface ClaudeExitPlanModeInput {
  plan: string;
  [key: string]: unknown;
}

export function claudeHookResponse(
  submission: AnnotationSubmission,
  toolInput: ClaudeExitPlanModeInput,
): ClaudeHookResponse {
  if (submission.status === 'approved') {
    // Claude Code >=2.1.199 discards an ExitPlanMode allow without updatedInput, so echo the
    // input verbatim: https://github.com/anthropics/claude-code/issues/74256
    //
    // setMode is what actually exits plan mode for the session. Without it, the allow only
    // grants this ExitPlanMode call — the session stays in `plan` and the agent can't touch
    // the filesystem on its next turn. The mode itself comes from the reviewer's choice in
    // the browser (acceptEdits by default, or auto).
    return {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'allow',
          updatedInput: toolInput,
          updatedPermissions: [{ type: 'setMode', mode: submission.approvalMode, destination: 'session' }],
        },
      },
    };
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'deny', message: formatAgentResponse(PLAN_TEMPLATES, submission, toolInput.plan) },
    },
  };
}
