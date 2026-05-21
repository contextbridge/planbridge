import { Button } from '@contextbridge/ui/components/ui/button';
import { Textarea } from '@contextbridge/ui/components/ui/textarea';
import { type FocusEvent, type KeyboardEvent } from 'react';
import type { ActiveCommentDraft } from './annotationTypes.ts';
import { useSubmitOnCmdEnter } from './useSubmitOnCmdEnter.ts';

export const annotationDraftCommentComposerTestIds = {
  container: 'plan-review-annotation-draft-comment',
  textarea: 'plan-review-annotation-draft-comment-textarea',
  cancelButton: 'plan-review-annotation-draft-comment-cancel',
  saveButton: 'plan-review-annotation-draft-comment-save',
};

export interface AnnotationDraftCommentComposerProps {
  draft: ActiveCommentDraft;
  onBodyChange: (body: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function AnnotationDraftCommentComposer({
  draft,
  onBodyChange,
  onCancel,
  onSave,
}: AnnotationDraftCommentComposerProps) {
  const title = draft.kind === 'edit-comment' ? 'Edit comment' : 'Add comment';
  const handleSubmitKeyDown = useSubmitOnCmdEnter(() => {
    if (draft.body.trim().length > 0) {
      onSave();
    }
  });
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }

    handleSubmitKeyDown(event);
  };
  const handleFocus = (event: FocusEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  };

  return (
    <div
      className="mt-3 border-t border-border pt-3"
      data-testid={annotationDraftCommentComposerTestIds.container}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Textarea
        autoFocus
        aria-label={title}
        className="min-h-28 resize-y rounded-md border bg-background px-3 py-3 text-sm leading-6 transition focus-visible:border-chart-3/40 focus-visible:ring-chart-3/10"
        data-testid={annotationDraftCommentComposerTestIds.textarea}
        onChange={(event) => {
          onBodyChange(event.target.value);
        }}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment."
        value={draft.body}
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          data-testid={annotationDraftCommentComposerTestIds.cancelButton}
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button
          data-testid={annotationDraftCommentComposerTestIds.saveButton}
          disabled={draft.body.trim().length === 0}
          onClick={onSave}
          type="button"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
