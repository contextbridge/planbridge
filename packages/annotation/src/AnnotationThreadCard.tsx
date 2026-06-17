import { cn } from '@contextbridge/ui/lib/utils';
import { AnnotationDraftCommentComposer } from './AnnotationDraftCommentComposer.tsx';
import type { ResolvedAnnotationThread } from './annotationTypes.ts';
import { InteractiveCommentCard } from './InteractiveCommentCard.tsx';
import { truncate } from './utils.ts';

export const annotationThreadCardTestIds = {
  card: (threadId: string) => `plan-review-annotation-thread-${threadId}`,
  removeButton: (threadId: string) => `plan-review-thread-remove-${threadId}`,
  comment: (messageId: string) => `plan-review-thread-comment-${messageId}`,
};

export interface AnnotationThreadCardProps {
  thread: ResolvedAnnotationThread;
  isActive: boolean;
  isCurrent: boolean;
  submitted: boolean;
  draftBody: string;
  onClick: () => void;
  onDraftBodyChange: (body: string) => void;
  onDraftCancel: () => void;
  onDraftSave: () => void;
  onHoverChange: (hovered: boolean) => void;
  onRequestRemove: () => void;
}

export function AnnotationThreadCard({
  thread,
  isActive,
  isCurrent,
  submitted,
  draftBody,
  onClick,
  onDraftBodyChange,
  onDraftCancel,
  onDraftSave,
  onHoverChange,
  onRequestRemove,
}: AnnotationThreadCardProps) {
  const disabled = submitted || thread.unresolved;
  const newThreadDraftOpen = thread.comments.some(
    (comment) => comment.kind === 'draft' && comment.mode === 'new-thread',
  );

  return (
    <InteractiveCommentCard
      className={cn(
        isActive ? 'border-chart-3/70 bg-background' : 'border-border bg-background hover:border-chart-3/40',
        newThreadDraftOpen && 'cb-draft-thread-attention',
      )}
      current={isCurrent}
      disabled={disabled}
      onClick={() => onClick()}
      onHoverChange={onHoverChange}
      onRequestRemove={newThreadDraftOpen ? onDraftCancel : onRequestRemove}
      removeButtonTestId={annotationThreadCardTestIds.removeButton(thread.id)}
      testId={annotationThreadCardTestIds.card(thread.id)}
    >
      <div className="flex items-start justify-between gap-3 pr-8">
        <blockquote className="border-l-4 border-chart-3/40 bg-chart-3/10 px-3 py-1.5 text-sm italic leading-6 text-foreground/85">
          {truncate(thread.quote, 110)}
        </blockquote>
        {thread.unresolved ? (
          <span className="rounded-md bg-chart-1/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-chart-1">
            Needs restore
          </span>
        ) : null}
      </div>
      <div>
        {thread.comments.map((comment) =>
          comment.kind === 'saved' ? (
            <p
              className="mt-3 text-sm leading-6 text-foreground/80"
              data-testid={annotationThreadCardTestIds.comment(comment.message.id)}
              key={comment.message.id}
            >
              {comment.message.body}
            </p>
          ) : (
            <AnnotationDraftCommentComposer
              draft={comment.draft}
              body={draftBody}
              key="draft"
              onBodyChange={onDraftBodyChange}
              onCancel={onDraftCancel}
              onSave={onDraftSave}
            />
          ),
        )}
      </div>
    </InteractiveCommentCard>
  );
}
