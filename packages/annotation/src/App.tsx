import type { AnnotationPayload, CommentThread } from '@contextbridge/shared/annotationSchema';
import { DOCS_URL, FEEDBACK_URL, GITHUB_REPO_URL, SLACK_COMMUNITY_URL } from '@contextbridge/shared/links';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { Header } from '@contextbridge/ui/components/Header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contextbridge/ui/components/ui/alert-dialog';
import 'highlight.js/styles/github-dark.css';
import { useEffect, useState } from 'react';
import './annotationStyles.css';
import './codeHighlightStyles.css';
import { AnnotatedMarkdown } from './AnnotatedMarkdown.tsx';
import { getAnnotationHighlightWarning } from './annotationHighlights.ts';
import { AnnotationPopover } from './AnnotationPopover.tsx';
import { CommentsSidebar } from './CommentsSidebar.tsx';
import { UpdateNoticeCard } from './UpdateNoticeCard.tsx';
import { useAnnotationInteractions } from './useAnnotationInteractions.ts';
import { useAnnotationState } from './useAnnotationState.ts';
import { useAnnotationAppContext } from './useAppContext.ts';

export const appTestIds = {
  container: 'plan-review-app',
  loading: 'plan-review-loading',
  highlightWarning: 'plan-review-highlight-warning',
  emptyState: 'plan-review-empty-state',
  removeDialog: 'plan-review-remove-dialog',
};

export interface AppProps {
  initialPayload?: AnnotationPayload;
  initialThreads?: CommentThread[];
  initialGlobalComment?: string;
}

export function App({ initialPayload, initialThreads, initialGlobalComment }: AppProps = {}) {
  const { fetchPayload, fetchUpdateNotice, analytics, buildInfo } = useAnnotationAppContext();
  const [payload, setPayload] = useState<AnnotationPayload | null>(initialPayload ?? null);
  const [updateNotice, setUpdateNotice] = useState<UpdateNotice | null>(null);
  const [updateNoticeDismissed, setUpdateNoticeDismissed] = useState(false);
  const reviewState = useAnnotationState({ initialThreads, initialGlobalComment });
  const annotationInteractions = useAnnotationInteractions({
    threads: reviewState.threads,
    submitted: reviewState.submission.submitted,
    activeDraft: reviewState.draft.active,
    onOpenAnnotationCommentDraft: reviewState.draft.open,
  });
  const highlightWarning = getAnnotationHighlightWarning();

  useEffect(() => {
    if (initialPayload) {
      analytics.capture('plan_review_viewed', { bytes: initialPayload.content.length });
      return;
    }

    fetchPayload()
      .then((next) => {
        setPayload(next);
        analytics.capture('plan_review_viewed', { bytes: next.content.length });
      })
      .catch(() => setPayload({ content: '(unable to load content)', contentKind: 'document' }));
  }, [initialPayload, fetchPayload, analytics]);

  useEffect(() => {
    fetchUpdateNotice()
      .then(setUpdateNotice)
      .catch(() => {});
  }, [fetchUpdateNotice]);

  const documentTitle = resolveDocumentTitle(payload);

  return (
    <>
      <title>{documentTitle}</title>
      {!payload ? (
        <main className="min-h-screen bg-background text-foreground" data-testid={appTestIds.container}>
          <Header
            docsHref={DOCS_URL}
            feedbackHref={FEEDBACK_URL}
            githubRepoHref={GITHUB_REPO_URL}
            slackHelpHref={SLACK_COMMUNITY_URL}
            version={buildInfo.version}
          />
          <div className="mx-auto max-w-4xl px-6 py-16">
            <p className="text-sm text-muted-foreground" data-testid={appTestIds.loading}>
              Loading…
            </p>
          </div>
        </main>
      ) : (
        <main className="min-h-screen bg-background text-foreground" data-testid={appTestIds.container}>
          <Header
            docsHref={DOCS_URL}
            feedbackHref={FEEDBACK_URL}
            githubRepoHref={GITHUB_REPO_URL}
            slackHelpHref={SLACK_COMMUNITY_URL}
            version={buildInfo.version}
          />
          <div className="mx-auto max-w-[88rem] px-4 py-4 sm:px-6 sm:py-6">
            {highlightWarning ? (
              <div
                className="mb-5 border-l-2 border-chart-1 px-3 py-2 text-sm leading-6 text-muted-foreground"
                data-testid={appTestIds.highlightWarning}
              >
                {highlightWarning}
              </div>
            ) : null}

            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(15rem,23rem)] gap-6">
              <section className="min-w-0">
                {payload.content.length > 0 ? (
                  <AnnotatedMarkdown
                    key={payload.content}
                    containerRef={annotationInteractions.handlePlanContainer}
                    content={payload.content}
                    assets={payload.assets}
                    onMouseUp={annotationInteractions.handleSelectionCapture}
                  />
                ) : (
                  <div
                    className="rounded-md border border-dashed border-border px-4 py-8 text-sm text-muted-foreground"
                    data-testid={appTestIds.emptyState}
                  >
                    No content was provided.
                  </div>
                )}
              </section>

              <CommentsSidebar
                activeAnnotationId={annotationInteractions.activeAnnotationId}
                annotations={annotationInteractions.resolvedAnnotations}
                globalComment={reviewState.globalComment}
                onAnnotationClick={annotationInteractions.focusAnnotationComment}
                onAnnotationHoverChange={annotationInteractions.setAnnotationHover}
                onRequestRemove={reviewState.removal.request}
                source={payload.metadata?.entrypoint}
                submission={reviewState.submission}
              />
            </div>

            <AnnotationPopover
              body={reviewState.draft.active?.body ?? ''}
              getRect={reviewState.draft.active?.getRect ?? null}
              onBodyChange={reviewState.draft.setBody}
              onCancel={reviewState.draft.close}
              onSave={reviewState.draft.save}
              open={reviewState.draft.active !== null}
            />

            <AlertDialog
              onOpenChange={(open) => {
                if (!open) {
                  reviewState.removal.request(null);
                }
              }}
              open={reviewState.removal.pendingId !== null}
            >
              <AlertDialogContent data-testid={appTestIds.removeDialog} size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove comment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will discard the entire thread. You can always add it back with a new selection.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={reviewState.removal.confirm} variant="destructive">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {updateNotice && !updateNoticeDismissed ? (
            <UpdateNoticeCard notice={updateNotice} onDismiss={() => setUpdateNoticeDismissed(true)} />
          ) : null}
        </main>
      )}
    </>
  );
}

const DEFAULT_DOCUMENT_TITLE = 'Review — PlanBridge';

function resolveDocumentTitle(payload: AnnotationPayload | null): string {
  if (!payload) return DEFAULT_DOCUMENT_TITLE;
  const sourcePath = payload.metadata?.sourcePath;
  const stem = sourcePath ? sourcePath.split('/').pop() || sourcePath : payload.title;
  return stem ? `${stem} — PlanBridge` : DEFAULT_DOCUMENT_TITLE;
}
