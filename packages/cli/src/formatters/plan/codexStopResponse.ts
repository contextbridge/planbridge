import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { PLAN_TEMPLATES } from './templates.ts';

export interface CodexStopResponse {
  readonly decision: 'block';
  readonly reason: string;
}

export interface CodexStopResponseOptions {
  readonly planId?: string;
}

// Codex Stop hooks treat `decision: 'block'` as "continue with `reason` as the next user prompt".
// Use that only for changes-requested feedback. On approval, return no continuation so Codex can
// fall back to its native Plan Mode approval flow instead of injecting an approval prompt that still
// runs under Plan Mode.
// Upstream output schema (more fields exist than we use; revisit on Codex bumps):
// https://github.com/openai/codex/blob/main/codex-rs/hooks/schema/generated/stop.command.output.schema.json
export function codexStopResponse(
  submission: AnnotationSubmission,
  planContent: string,
  opts: CodexStopResponseOptions = {},
): CodexStopResponse | null {
  if (submission.status === 'approved') return null;

  return {
    decision: 'block',
    reason: formatAgentResponse(PLAN_TEMPLATES, submission, planContent, opts),
  };
}
