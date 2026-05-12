import type { AnnotationEntrypoint } from '@contextbridge/shared/annotationSchema';
import { Button } from '@contextbridge/ui/components/ui/button';

export const submitBarTestIds = {
  countdown: 'plan-review-submit-countdown',
  codexHandoffNotice: 'plan-review-submit-codex-handoff',
  error: 'plan-review-submit-error',
  button: 'plan-review-submit-button',
};

export interface SubmissionState {
  submit: () => Promise<void>;
  submitting: boolean;
  submitted: boolean;
  closeCountdownSeconds: number | null;
  error: string | null;
  label: string;
  feedbackCount: number;
}

export interface SubmitBarProps {
  submission: SubmissionState;
  source?: AnnotationEntrypoint;
}

export function SubmitBar({ submission, source }: SubmitBarProps) {
  const isCodexApproval = source === 'hook_codex' && submission.feedbackCount === 0;

  return (
    <>
      {submission.submitted && submission.closeCountdownSeconds !== null ? (
        <div
          className="rounded-md border border-border px-3 py-2 text-sm leading-6 text-muted-foreground"
          data-testid={submitBarTestIds.countdown}
        >
          {isCodexApproval ? (
            <>
              <span>Approved.</span>
              <strong className="block" data-testid={submitBarTestIds.codexHandoffNotice}>
                Return to Codex to confirm implementation.
              </strong>
              <span>
                This window will close in {formatCountdownLabel(submission.closeCountdownSeconds)}.
              </span>
            </>
          ) : (
            `This window will close in ${formatCountdownLabel(submission.closeCountdownSeconds)}.`
          )}
        </div>
      ) : null}

      {submission.error ? (
        <div
          className="border-l-2 border-destructive px-3 py-2 text-sm leading-6 text-foreground"
          data-testid={submitBarTestIds.error}
        >
          {submission.error}
        </div>
      ) : null}

      <Button
        className="w-full"
        data-testid={submitBarTestIds.button}
        disabled={submission.submitted || submission.submitting}
        onClick={() => void submission.submit()}
      >
        {submission.submitting ? 'Submitting…' : submission.label}
      </Button>
    </>
  );
}

function formatCountdownLabel(remainingSeconds: number): string {
  return `${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`;
}
