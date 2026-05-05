import { cn } from '@contextbridge/ui/lib/utils';
import type { ResolvedAnnotation } from './annotationTypes.ts';
import { getPrimaryMessage } from './commentModel.ts';
import { InteractiveCommentCard } from './InteractiveCommentCard.tsx';
import { truncate } from './utils.ts';

export const annotationCommentCardTestIds = {
  card: (threadId: string) => `plan-review-annotation-comment-${threadId}`,
  removeButton: (threadId: string) => `plan-review-comment-remove-${threadId}`,
};

export interface AnnotationCommentCardProps {
  annotation: ResolvedAnnotation;
  isActive: boolean;
  submitted: boolean;
  onClick: () => void;
  onHoverChange: (hovered: boolean) => void;
  onRequestRemove: () => void;
}

export function AnnotationCommentCard({
  annotation,
  isActive,
  submitted,
  onClick,
  onHoverChange,
  onRequestRemove,
}: AnnotationCommentCardProps) {
  const disabled = submitted || annotation.unresolved;

  return (
    <InteractiveCommentCard
      className={cn(
        isActive ? 'border-chart-3/70 bg-chart-3/10' : 'border-border bg-background hover:border-chart-3/40',
      )}
      disabled={disabled}
      onClick={() => onClick()}
      onHoverChange={onHoverChange}
      onRequestRemove={onRequestRemove}
      removeButtonTestId={annotationCommentCardTestIds.removeButton(annotation.thread.id)}
      testId={annotationCommentCardTestIds.card(annotation.thread.id)}
    >
      <div className="flex items-start justify-between gap-3 pr-8">
        <blockquote className="border-l-4 border-chart-3/40 bg-chart-3/10 px-3 py-1.5 text-sm italic leading-6 text-foreground/85">
          {truncate(annotation.thread.subject.anchor.quote.exact, 110)}
        </blockquote>
        {annotation.unresolved ? (
          <span className="rounded-md bg-chart-1/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-chart-1">
            Needs restore
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-foreground/80">{getPrimaryMessage(annotation.thread).body}</p>
    </InteractiveCommentCard>
  );
}
