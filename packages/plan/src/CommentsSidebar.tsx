import type { PlanReviewSource } from '@contextbridge/shared/planReviewSchema';
import { cn } from '@contextbridge/ui/lib/utils';
import { AnnotationCommentCard } from './AnnotationCommentCard.tsx';
import type { ResolvedAnnotation } from './annotationTypes.ts';
import { GlobalCommentComposer, type GlobalCommentState } from './GlobalCommentComposer.tsx';
import { type SubmissionState, SubmitBar } from './SubmitBar.tsx';

export const commentsSidebarTestIds = {
  container: 'plan-review-comments-sidebar',
  emptyState: 'plan-review-comments-empty',
};

export interface CommentsSidebarProps {
  annotations: ResolvedAnnotation[];
  activeAnnotationId: string | null;
  globalComment: GlobalCommentState;
  submission: SubmissionState;
  source?: PlanReviewSource;
  onAnnotationClick: (annotation: ResolvedAnnotation) => void;
  onAnnotationHoverChange: (annotationId: string, hovered: boolean) => void;
  onRequestRemove: (threadId: string) => void;
}

export function CommentsSidebar({
  annotations,
  activeAnnotationId,
  globalComment,
  submission,
  source,
  onAnnotationClick,
  onAnnotationHoverChange,
  onRequestRemove,
}: CommentsSidebarProps) {
  return (
    <aside
      className="sticky top-[4.25rem] flex max-h-[calc(100vh-4.25rem)] min-w-0 flex-col self-start"
      data-testid={commentsSidebarTestIds.container}
    >
      <section className={cn(SIDEBAR_PANEL_CLASS, 'flex min-h-0 flex-1 flex-col gap-4')}>
        <div className="flex min-h-0 flex-1 flex-col">
          <h2 className="text-lg font-semibold tracking-tight">Comments</h2>
          <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
            {annotations.length === 0 ? (
              <div
                className="rounded-md border border-dashed border-border px-3 py-4 text-sm leading-6 text-muted-foreground"
                data-testid={commentsSidebarTestIds.emptyState}
              >
                No comments yet
              </div>
            ) : (
              annotations.map((annotation) => (
                <AnnotationCommentCard
                  key={annotation.thread.id}
                  annotation={annotation}
                  isActive={activeAnnotationId === annotation.thread.id}
                  onClick={() => onAnnotationClick(annotation)}
                  onHoverChange={(hovered) => onAnnotationHoverChange(annotation.thread.id, hovered)}
                  onRequestRemove={() => onRequestRemove(annotation.thread.id)}
                  submitted={submission.submitted}
                />
              ))
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-4">
          <GlobalCommentComposer globalComment={globalComment} submitted={submission.submitted} />
          <SubmitBar source={source} submission={submission} />
        </div>
      </section>
    </aside>
  );
}

const SIDEBAR_PANEL_CLASS = 'rounded-md border border-border p-4';
