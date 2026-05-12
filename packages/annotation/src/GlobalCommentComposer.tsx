import { Textarea } from '@contextbridge/ui/components/ui/textarea';

export const globalCommentComposerTestIds = {
  textarea: 'plan-review-global-comment-textarea',
};

export interface GlobalCommentState {
  body: string;
  setBody: (body: string) => void;
}

export interface GlobalCommentComposerProps {
  globalComment: GlobalCommentState;
  submitted: boolean;
}

export function GlobalCommentComposer({ globalComment, submitted }: GlobalCommentComposerProps) {
  return (
    <Textarea
      className="min-h-24 resize-none rounded-md border bg-background text-sm leading-6 transition focus-visible:border-chart-3/40 focus-visible:ring-chart-3/10"
      disabled={submitted}
      data-testid={globalCommentComposerTestIds.textarea}
      onChange={(event) => globalComment.setBody(event.target.value)}
      placeholder="Add overall feedback…"
      value={globalComment.body}
    />
  );
}
