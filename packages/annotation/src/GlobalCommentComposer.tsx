import { Textarea } from '@contextbridge/ui/components/ui/textarea';
import type { SubmissionState } from './SubmitBar.tsx';
import { useSubmitOnCmdEnter } from './useSubmitOnCmdEnter.ts';

export const globalCommentComposerTestIds = {
  textarea: 'plan-review-global-comment-textarea',
};

export interface GlobalCommentState {
  body: string;
  setBody: (body: string) => void;
}

export interface GlobalCommentComposerProps {
  globalComment: GlobalCommentState;
  submission: Pick<SubmissionState, 'submit' | 'submitting' | 'submitted'>;
}

export function GlobalCommentComposer({ globalComment, submission }: GlobalCommentComposerProps) {
  const { submitted, submitting, submit } = submission;
  const handleKeyDown = useSubmitOnCmdEnter(() => {
    if (submitted || submitting) {
      return;
    }

    void submit();
  });

  return (
    <Textarea
      className="min-h-24 resize-none rounded-md border bg-background text-sm leading-6 transition focus-visible:border-chart-3/40 focus-visible:ring-chart-3/10"
      disabled={submitted}
      data-testid={globalCommentComposerTestIds.textarea}
      onChange={(event) => globalComment.setBody(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Add overall feedback…"
      value={globalComment.body}
    />
  );
}
