import type { AnnotationEntrypoint } from '@contextbridge/shared/annotationSchema';
import { cn } from '@contextbridge/ui/lib/utils';
import { useEffect, useRef } from 'react';
import { AnnotationThreadCard } from './AnnotationThreadCard.tsx';
import type { ResolvedAnnotationThread } from './annotationTypes.ts';
import { CommentNavigationBar } from './CommentNavigationBar.tsx';
import { GlobalCommentComposer, type GlobalCommentState } from './GlobalCommentComposer.tsx';
import { type SubmissionState, SubmitBar } from './SubmitBar.tsx';

export const commentsSidebarTestIds = {
  container: 'plan-review-comments-sidebar',
  counter: 'plan-review-comment-navigation-position',
  emptyState: 'plan-review-comments-empty',
  threadList: 'plan-review-comments-thread-list',
  composer: 'plan-review-comments-composer',
};

export interface SidebarNavigationState {
  activePosition: number;
  total: number;
  disabled: boolean;
}

export interface CommentsSidebarProps {
  threads: ResolvedAnnotationThread[];
  currentThreadId: string | null;
  highlightedAnnotationId: string | null;
  globalComment: GlobalCommentState;
  navigation: SidebarNavigationState | null;
  submission: SubmissionState;
  source?: AnnotationEntrypoint;
  onThreadClick: (thread: ResolvedAnnotationThread) => void;
  onAnnotationHoverChange: (annotationId: string, hovered: boolean) => void;
  onDraftBodyChange: (body: string) => void;
  onDraftCancel: () => void;
  onDraftSave: () => void;
  onRequestRemove: (threadId: string) => void;
}

export function CommentsSidebar({
  threads,
  currentThreadId,
  highlightedAnnotationId,
  globalComment,
  navigation,
  submission,
  source,
  onThreadClick,
  onAnnotationHoverChange,
  onDraftBodyChange,
  onDraftCancel,
  onDraftSave,
  onRequestRemove,
}: CommentsSidebarProps) {
  const currentCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    currentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentThreadId]);

  return (
    <aside
      className="flex min-w-0 flex-col self-start xl:sticky xl:top-[4.25rem] xl:max-h-[calc(100vh-4.25rem)]"
      data-testid={commentsSidebarTestIds.container}
    >
      <section className={cn(SIDEBAR_PANEL_CLASS, 'flex min-h-0 flex-1 flex-col gap-4')}>
        <div className="flex shrink-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Comments</h2>
            {navigation ? (
              <p
                className="text-sm text-muted-foreground"
                data-comment-active-position={navigation.activePosition}
                data-comment-total={navigation.total}
                data-testid={commentsSidebarTestIds.counter}
              >
                Comment <span className="font-medium tabular-nums text-foreground">{navigation.activePosition}</span> of{' '}
                <span className="font-medium tabular-nums text-foreground">{navigation.total}</span>
              </p>
            ) : null}
          </div>
          {navigation && !navigation.disabled ? <CommentNavigationBar /> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1" data-testid={commentsSidebarTestIds.threadList}>
            {threads.length === 0 ? (
              <div
                className="rounded-md border border-dashed border-border px-3 py-4 text-sm leading-6 text-muted-foreground"
                data-testid={commentsSidebarTestIds.emptyState}
              >
                No comments yet
              </div>
            ) : (
              threads.map((thread) => {
                const isCurrent = currentThreadId === thread.id;

                return (
                  <div key={thread.id} ref={isCurrent ? currentCardRef : undefined}>
                    <AnnotationThreadCard
                      thread={thread}
                      isActive={highlightedAnnotationId === thread.id}
                      isCurrent={isCurrent}
                      onClick={() => onThreadClick(thread)}
                      onDraftBodyChange={onDraftBodyChange}
                      onDraftCancel={onDraftCancel}
                      onDraftSave={onDraftSave}
                      onHoverChange={(hovered) => onAnnotationHoverChange(thread.id, hovered)}
                      onRequestRemove={() => onRequestRemove(thread.id)}
                      submitted={submission.submitted}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
          className="sticky bottom-0 flex shrink-0 flex-col gap-3 border-t border-border bg-background pt-4 xl:static"
          data-testid={commentsSidebarTestIds.composer}
        >
          <GlobalCommentComposer globalComment={globalComment} submission={submission} />
          <SubmitBar source={source} submission={submission} />
        </div>
      </section>
    </aside>
  );
}

const SIDEBAR_PANEL_CLASS = 'rounded-md border border-border p-4';
