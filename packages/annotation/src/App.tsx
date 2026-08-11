import type { AnnotationPayload, CommentThread } from '@contextbridge/shared/annotationSchema';
import { DOCS_URL, FEEDBACK_URL, GITHUB_REPO_URL, SLACK_COMMUNITY_URL } from '@contextbridge/shared/links';
import type { SettingsPatch } from '@contextbridge/shared/settingsSchema';
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
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import './annotationStyles.css';
import './codeHighlightStyles.css';
import { AnnotatedMarkdown } from './AnnotatedMarkdown.tsx';
import { getAnnotationHighlightWarning } from './annotationHighlights.ts';
import { CommentsSidebar } from './CommentsSidebar.tsx';
import { ThemePicker } from './ThemePicker.tsx';
import type { ThemePreference } from './themes.ts';
import { UpdateNoticeCard } from './UpdateNoticeCard.tsx';
import { useAnnotationInteractions } from './useAnnotationInteractions.ts';
import { useAnnotationState } from './useAnnotationState.ts';
import { useAnnotationAppContext } from './useAppContext.ts';
import { useTheme } from './useTheme.ts';
import { WarningNotice } from './WarningNotice.tsx';

export const appTestIds = {
  container: 'plan-review-app',
  loading: 'plan-review-loading',
  highlightWarning: 'plan-review-highlight-warning',
  emptyState: 'plan-review-empty-state',
  settingsSaveWarning: 'plan-review-settings-save-warning',
  removeDialog: 'plan-review-remove-dialog',
  discardDraftDialog: 'plan-review-discard-draft-dialog',
  discardDraftDialogCancelButton: 'plan-review-discard-draft-dialog-cancel',
  discardDraftDialogActionButton: 'plan-review-discard-draft-dialog-action',
  closeReviewDialog: 'plan-review-close-review-dialog',
  closeReviewDialogCancelButton: 'plan-review-close-review-dialog-cancel',
  closeReviewDialogActionButton: 'plan-review-close-review-dialog-action',
};

export const appCopy = {
  emptyState: 'No content was provided.',
  settingsSaveFailed: 'Your settings could not be saved. Changes apply to this session only.',
} as const;

export interface AppProps {
  initialPayload?: AnnotationPayload;
  initialThreads?: CommentThread[];
  initialGlobalComment?: string;
}

export function App({ initialPayload, initialThreads, initialGlobalComment }: AppProps = {}) {
  const { fetchPayload, fetchUpdateNotice, analytics, buildInfo, settings, updateSettings, themeController } =
    useAnnotationAppContext();
  const [payload, setPayload] = useState<AnnotationPayload | null>(initialPayload ?? null);
  const [updateNotice, setUpdateNotice] = useState<UpdateNotice | null>(null);
  const [updateNoticeDismissed, setUpdateNoticeDismissed] = useState(false);
  const reviewState = useAnnotationState({ initialThreads, initialGlobalComment });
  const [settingsSaveFailed, setSettingsSaveFailed] = useState(false);
  const saveSettings = (patch: SettingsPatch) => {
    void updateSettings(patch).then((persisted) => setSettingsSaveFailed(!persisted));
  };
  const themeState = useTheme(themeController, { initialPreference: settings.ui.theme });
  const handleThemeSelect = (preference: ThemePreference) => {
    themeState.selectTheme(preference);
    saveSettings({ ui: { theme: preference } });
  };
  const annotationInteractions = useAnnotationInteractions({
    threads: reviewState.threads,
    submitted: reviewState.submission.submitted,
    activeDraft: reviewState.draft.active,
    onOpenAnnotationCommentDraft: reviewState.draft.open,
    onRequestCloseAnnotationCommentDraft: reviewState.draft.requestClose,
  });
  const highlightWarning = getAnnotationHighlightWarning();
  const showCommentNavigation = annotationInteractions.navigation.total > 0;
  const commentNavigationDisabled = reviewState.draft.active !== null;
  const themePicker = <ThemePicker preference={themeState.preference} onSelect={handleThemeSelect} />;

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
        <Loading buildInfo={buildInfo} settings={themePicker} />
      ) : (
        <main className="min-h-screen bg-background text-foreground" data-testid={appTestIds.container}>
          <Header
            docsHref={DOCS_URL}
            feedbackHref={FEEDBACK_URL}
            githubRepoHref={GITHUB_REPO_URL}
            settings={themePicker}
            slackHelpHref={SLACK_COMMUNITY_URL}
            version={buildInfo.version}
          />
          <div className="w-full px-4 py-4 sm:px-6 sm:py-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,52rem)_minmax(0,1fr)_minmax(15rem,28rem)]">
              {settingsSaveFailed ? (
                <WarningNotice testId={appTestIds.settingsSaveWarning}>{appCopy.settingsSaveFailed}</WarningNotice>
              ) : null}

              {highlightWarning ? (
                <WarningNotice testId={appTestIds.highlightWarning}>{highlightWarning}</WarningNotice>
              ) : null}

              <section className="min-w-0 xl:col-start-2">
                {payload.content.length > 0 ? (
                  <AnnotatedMarkdown
                    key={payload.content}
                    containerRef={annotationInteractions.handlePlanContainer}
                    content={payload.content}
                    assets={payload.assets}
                    onMouseUp={annotationInteractions.handleSelectionCapture}
                    themeId={themeState.theme.id}
                  />
                ) : (
                  <div
                    className="rounded-md border border-dashed border-border px-4 py-8 text-sm text-muted-foreground"
                    data-testid={appTestIds.emptyState}
                  >
                    {appCopy.emptyState}
                  </div>
                )}
              </section>

              <div className="min-w-0 xl:col-start-4 xl:row-span-2 xl:row-start-1">
                <CommentsSidebar
                  threads={annotationInteractions.resolvedThreads}
                  currentThreadId={annotationInteractions.currentSidebarThreadId}
                  draftBody={reviewState.draft.body}
                  globalComment={reviewState.globalComment}
                  highlightedAnnotationId={annotationInteractions.highlightedAnnotationId}
                  navigation={
                    showCommentNavigation
                      ? {
                          activePosition: annotationInteractions.navigation.activePosition,
                          disabled: commentNavigationDisabled,
                          total: annotationInteractions.navigation.total,
                        }
                      : null
                  }
                  onDraftBodyChange={reviewState.draft.setBody}
                  onDraftCancel={reviewState.draft.requestClose}
                  onDraftSave={reviewState.draft.save}
                  onThreadClick={annotationInteractions.focusAnnotationThread}
                  onAnnotationHoverChange={annotationInteractions.setAnnotationHover}
                  onRequestRemove={reviewState.removal.request}
                  source={payload.metadata?.entrypoint}
                  submission={reviewState.submission}
                />
              </div>
            </div>

            <RemoveCommentDialog
              onConfirm={reviewState.removal.confirm}
              onOpenChange={(open) => {
                if (!open) {
                  reviewState.removal.request(null);
                }
              }}
              open={reviewState.removal.pendingId !== null}
            />

            <DiscardDraftDialog
              onConfirm={reviewState.draft.confirmDiscard}
              onOpenChange={(open) => {
                if (!open) {
                  reviewState.draft.dismissDiscardDialog();
                }
              }}
              open={reviewState.draft.discardDialogOpen}
            />

            <CloseReviewDialog
              cancelLabel={reviewState.closeReview.cancelLabel}
              description={reviewState.closeReview.description}
              onConfirm={() => void reviewState.closeReview.confirmRecommendedAction()}
              onOpenChange={(open) => {
                if (!open) {
                  reviewState.closeReview.dismissDialog();
                }
              }}
              open={reviewState.closeReview.dialogOpen}
              primaryActionLabel={reviewState.closeReview.primaryActionLabel}
              title={reviewState.closeReview.title}
            />
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

interface LoadingProps {
  buildInfo: { readonly version: string };
  settings: ReactNode;
}

function Loading({ buildInfo, settings }: LoadingProps) {
  return (
    <main className="min-h-screen bg-background text-foreground" data-testid={appTestIds.container}>
      <Header
        docsHref={DOCS_URL}
        feedbackHref={FEEDBACK_URL}
        githubRepoHref={GITHUB_REPO_URL}
        settings={settings}
        slackHelpHref={SLACK_COMMUNITY_URL}
        version={buildInfo.version}
      />
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-sm text-muted-foreground" data-testid={appTestIds.loading}>
          Loading…
        </p>
      </div>
    </main>
  );
}

interface RemoveCommentDialogProps {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function RemoveCommentDialog({ onConfirm, onOpenChange, open }: RemoveCommentDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent data-testid={appTestIds.removeDialog} size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove comment?</AlertDialogTitle>
          <AlertDialogDescription>
            This will discard the entire thread. You can always add it back with a new selection.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DiscardDraftDialogProps {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function DiscardDraftDialog({ onConfirm, onOpenChange, open }: DiscardDraftDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent data-testid={appTestIds.discardDraftDialog} size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved comment?</AlertDialogTitle>
          <AlertDialogDescription>
            Your comment has not been saved. If you leave now your text will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={appTestIds.discardDraftDialogCancelButton}>Keep Editing</AlertDialogCancel>
          <AlertDialogAction
            data-testid={appTestIds.discardDraftDialogActionButton}
            onClick={onConfirm}
            variant="destructive"
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CloseReviewDialogProps {
  cancelLabel: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  primaryActionLabel: string;
  title: string;
}

function CloseReviewDialog({
  cancelLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  primaryActionLabel,
  title,
}: CloseReviewDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent data-testid={appTestIds.closeReviewDialog} size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={appTestIds.closeReviewDialogCancelButton}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction data-testid={appTestIds.closeReviewDialogActionButton} onClick={onConfirm}>
            {primaryActionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
