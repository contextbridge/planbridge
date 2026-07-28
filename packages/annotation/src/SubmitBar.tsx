import type { AnnotationEntrypoint, ApprovalMode } from '@contextbridge/shared/annotationSchema';
import { Button } from '@contextbridge/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@contextbridge/ui/components/ui/dropdown-menu';
import { ChevronDownIcon } from 'lucide-react';
import { approvalModeCopy, submitBarCopy, withApprovalMode } from './useAnnotationState.ts';

export const submitBarTestIds = {
  countdown: 'plan-review-submit-countdown',
  codexHandoffNotice: 'plan-review-submit-codex-handoff',
  error: 'plan-review-submit-error',
  button: 'plan-review-submit-button',
  modeTrigger: 'plan-review-submit-mode-trigger',
  modeOption: (mode: ApprovalMode): string => `plan-review-submit-mode-option-${mode}`,
};

export interface SubmissionState {
  submit: () => Promise<void>;
  submitting: boolean;
  submitted: boolean;
  closeCountdownSeconds: number | null;
  error: string | null;
  label: string;
  feedbackCount: number;
  approvalMode: ApprovalMode;
  setApprovalMode: (mode: ApprovalMode) => void;
}

export interface SubmitBarProps {
  submission: SubmissionState;
  source?: AnnotationEntrypoint;
}

export function SubmitBar({ submission, source }: SubmitBarProps) {
  const isCodexApproval = source === 'hook_codex' && submission.feedbackCount === 0;
  const showModeTrigger = canChooseApprovalMode(source, submission);

  return (
    <>
      {submission.submitted && submission.closeCountdownSeconds !== null ? (
        <div
          className="rounded-md border border-border px-3 py-2 text-sm leading-6 text-muted-foreground"
          data-countdown-seconds={submission.closeCountdownSeconds}
          data-testid={submitBarTestIds.countdown}
        >
          {isCodexApproval ? (
            <>
              <span>Approved.</span>
              <strong className="block" data-testid={submitBarTestIds.codexHandoffNotice}>
                Return to Codex to confirm implementation.
              </strong>
              <span>This window will close in {formatCountdownLabel(submission.closeCountdownSeconds)}.</span>
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

      <div className="flex w-full">
        <Button
          className={showModeTrigger ? 'flex-1 rounded-r-none' : 'w-full'}
          data-testid={submitBarTestIds.button}
          disabled={submission.submitted || submission.submitting}
          onClick={() => void submission.submit()}
        >
          {getSubmitButtonLabel(source, submission)}
        </Button>

        {showModeTrigger ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Choose approval mode"
                className="w-8 rounded-l-none border-l border-l-primary-foreground/20 px-0 has-[>svg]:px-0"
                data-testid={submitBarTestIds.modeTrigger}
                disabled={submission.submitting}
                title="Choose approval mode"
              >
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                onValueChange={(value) => submission.setApprovalMode(value as ApprovalMode)}
                value={submission.approvalMode}
              >
                <DropdownMenuRadioItem data-testid={submitBarTestIds.modeOption('acceptEdits')} value="acceptEdits">
                  {approvalModeCopy.acceptEdits}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem data-testid={submitBarTestIds.modeOption('auto')} value="auto">
                  {approvalModeCopy.auto}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </>
  );
}

export function shouldSuffixApprovalMode(
  source: AnnotationEntrypoint | undefined,
  submission: SubmissionState,
): boolean {
  return canChooseApprovalMode(source, submission) && submission.approvalMode !== 'acceptEdits';
}

function canChooseApprovalMode(source: AnnotationEntrypoint | undefined, submission: SubmissionState): boolean {
  return source === 'hook_claude' && submission.feedbackCount === 0 && !submission.submitted;
}

function formatCountdownLabel(remainingSeconds: number): string {
  return `${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`;
}

function getSubmitButtonLabel(source: AnnotationEntrypoint | undefined, submission: SubmissionState): string {
  if (submission.submitting) {
    return submitBarCopy.submitting;
  }

  if (shouldSuffixApprovalMode(source, submission)) {
    return withApprovalMode(submission.label, submission.approvalMode);
  }

  return submission.label;
}
