import type {
  AnnotationStatus,
  AnnotationSubmission,
  CommentThread,
  StoredAnnotationAnchor,
} from '@contextbridge/shared/annotationSchema';
import { getErrorMessage } from '@contextbridge/shared/errors';
import { useEffect, useState } from 'react';
import { type ActiveCommentDraft, isAnnotationCommentThread } from './annotationTypes.ts';
import { createAnnotationCommentThread, createGlobalCommentThread, updateThreadMessageBody } from './commentModel.ts';
import { useAnnotationAppContext } from './useAppContext.ts';

export type OpenAnnotationCommentDraftArgs =
  | { kind: 'new-thread'; anchor: StoredAnnotationAnchor; body?: string }
  | { kind: 'edit-comment'; threadId: string; messageId: string; anchor: StoredAnnotationAnchor; body: string };

export interface UseAnnotationStateArgs {
  initialThreads?: CommentThread[];
  initialGlobalComment?: string;
}

type PendingDraftAction =
  | { kind: 'close' }
  | { kind: 'replace'; draft: OpenAnnotationCommentDraftArgs }
  | { kind: 'remove'; threadId: string };

interface CloseReviewDialogContent {
  readonly title: string;
  readonly description: string;
  readonly primaryActionLabel: string;
}

export function useAnnotationState({ initialThreads, initialGlobalComment }: UseAnnotationStateArgs = {}) {
  const { submitAnnotation, browser, autoCloseDelaySeconds } = useAnnotationAppContext();

  const [threads, setThreads] = useState<CommentThread[]>(() =>
    (initialThreads ?? []).filter(isAnnotationCommentThread),
  );
  const [activeDraft, setActiveDraft] = useState<ActiveCommentDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [globalCommentBody, setGlobalCommentBody] = useState(initialGlobalComment ?? '');
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [closeCountdownSeconds, setCloseCountdownSeconds] = useState<number | null>(null);
  const [closeReviewDialogOpen, setCloseReviewDialogOpen] = useState(false);

  const trimmedGlobal = globalCommentBody.trim();
  const feedbackCount = getFeedbackCount(threads, trimmedGlobal);
  const closeReviewDialogContent = getCloseReviewDialogContent(feedbackCount);
  const submitLabel = submitted ? 'Submitted' : feedbackCount === 0 ? 'Approve Plan' : 'Submit Feedback';

  const [pendingDraftAction, setPendingDraftAction] = useState<PendingDraftAction | null>(null);

  const closeDraft = () => {
    setActiveDraft(null);
    setPendingDraftAction(null);
  };

  const requestDraftAction = (action: PendingDraftAction) => {
    if (!activeDraft || !getDraftDirty(activeDraft, threads)) {
      runDraftAction(action);
      return;
    }

    setPendingDraftAction(action);
  };

  const requestCloseDraft = () => {
    requestDraftAction({ kind: 'close' });
  };

  const openAnnotationCommentDraft = (draft: OpenAnnotationCommentDraftArgs) => {
    requestDraftAction({ kind: 'replace', draft });
  };

  const setDraftBody = (body: string) => {
    setActiveDraft((current) => (current ? { ...current, body } : current));
  };

  const saveDraft = () => {
    if (submitted || !activeDraft) {
      return;
    }

    const nextBody = activeDraft.body.trim();
    if (nextBody.length === 0) {
      return;
    }

    if (activeDraft.kind === 'edit-comment') {
      setThreads((current) => updateThreadMessageBody(current, activeDraft.threadId, activeDraft.messageId, nextBody));
    } else {
      setThreads((current) => [...current, createAnnotationCommentThread(activeDraft.anchor, nextBody)]);
    }
    closeDraft();
  };

  const removeComment = (threadId: string) => {
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    setActiveDraft((current) => (current?.kind === 'edit-comment' && current.threadId === threadId ? null : current));
  };

  const requestRemove = (threadId: string | null) => {
    if (!threadId) {
      setPendingRemoveId(null);
      return;
    }

    if (
      activeDraft?.kind === 'edit-comment' &&
      activeDraft.threadId === threadId &&
      getDraftDirty(activeDraft, threads)
    ) {
      setPendingDraftAction({ kind: 'remove', threadId });
      return;
    }

    setPendingRemoveId(threadId);
  };

  const confirmRemove = () => {
    if (!pendingRemoveId) {
      return;
    }

    removeComment(pendingRemoveId);
    setPendingRemoveId(null);
  };

  const submitThreads = async (nextThreads: CommentThread[]) => {
    if (submitting || submitted) {
      return;
    }

    const submissionThreads: CommentThread[] = [...nextThreads];
    if (trimmedGlobal.length > 0) {
      submissionThreads.push(createGlobalCommentThread(trimmedGlobal));
    }

    const submission: AnnotationSubmission = {
      status: getSubmitStatus(nextThreads, trimmedGlobal),
      threads: submissionThreads,
    };

    setSubmitError(null);
    setSubmitting(true);

    try {
      await submitAnnotation(submission);
      closeDraft();
      setSubmitted(true);
      setCloseCountdownSeconds(autoCloseDelaySeconds);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (activeDraft && getDraftDirty(activeDraft, threads)) {
      requestCloseDraft();
      return;
    }

    await submitThreads(threads);
  };

  const dismissCloseReviewDialog = () => {
    setCloseReviewDialogOpen(false);
  };

  const confirmCloseReviewRecommendedAction = async () => {
    setCloseReviewDialogOpen(false);
    await submit();
  };

  const confirmDiscardDraft = () => {
    if (!pendingDraftAction) {
      return;
    }

    runDraftAction(pendingDraftAction);
  };

  function runDraftAction(action: PendingDraftAction): void {
    switch (action.kind) {
      case 'close':
        closeDraft();
        return;
      case 'replace':
        setActiveDraft(normalizeDraft(action.draft));
        setPendingDraftAction(null);
        return;
      case 'remove':
        setActiveDraft(null);
        setPendingDraftAction(null);
        setPendingRemoveId(action.threadId);
        return;
    }
  }

  useEffect(() => {
    if (submitted) {
      return;
    }

    return browser.addBeforeUnloadGuard({
      onAttemptedUnload: () => setCloseReviewDialogOpen(true),
    });
  }, [browser, submitted]);

  useEffect(() => {
    if (!submitted) {
      return;
    }

    let remaining = autoCloseDelaySeconds;
    let cancel: () => void = () => {};
    const tick = () => {
      if (remaining <= 1) {
        browser.closeWindow();
        return;
      }
      remaining -= 1;
      setCloseCountdownSeconds(remaining);
      cancel = browser.scheduleTimeout(tick, 1000);
    };
    cancel = browser.scheduleTimeout(tick, 1000);

    return () => {
      cancel();
    };
  }, [autoCloseDelaySeconds, browser, submitted]);

  return {
    threads,
    draft: {
      active: activeDraft,
      open: openAnnotationCommentDraft,
      requestClose: requestCloseDraft,
      setBody: setDraftBody,
      save: saveDraft,
      discardDialogOpen: pendingDraftAction !== null,
      confirmDiscard: confirmDiscardDraft,
      dismissDiscardDialog: () => setPendingDraftAction(null),
    },
    globalComment: {
      body: globalCommentBody,
      setBody: setGlobalCommentBody,
    },
    submission: {
      submit,
      submitting,
      error: submitError,
      submitted,
      closeCountdownSeconds,
      label: submitLabel,
      feedbackCount,
    },
    closeReview: {
      dialogOpen: closeReviewDialogOpen,
      dismissDialog: dismissCloseReviewDialog,
      confirmRecommendedAction: confirmCloseReviewRecommendedAction,
      cancelLabel: closeReviewDialogCopy.cancelLabel,
      ...closeReviewDialogContent,
    },
    removal: {
      pendingId: pendingRemoveId,
      request: requestRemove,
      confirm: confirmRemove,
    },
  };
}

function normalizeDraft(draft: OpenAnnotationCommentDraftArgs): ActiveCommentDraft {
  if (draft.kind === 'new-thread') {
    return { ...draft, body: draft.body ?? '' };
  }

  return draft;
}

function getDraftDirty(draft: ActiveCommentDraft, threads: CommentThread[]): boolean {
  const nextBody = draft.body.trim();
  if (draft.kind === 'new-thread') {
    return nextBody.length > 0;
  }

  const savedBody =
    threads.find((thread) => thread.id === draft.threadId)?.messages.find((message) => message.id === draft.messageId)
      ?.body ?? '';
  return nextBody !== savedBody.trim();
}

function getFeedbackCount(threads: CommentThread[], trimmedGlobal: string): number {
  return threads.length + (trimmedGlobal.length > 0 ? 1 : 0);
}

export const closeReviewDialogCopy = {
  cancelLabel: 'Keep Reviewing',
  empty: {
    title: 'Approve plan before closing?',
    description:
      'No comments have been added. Select Approve Plan to tell the agent to proceed with the plan as written.',
    primaryActionLabel: 'Approve Plan',
  },
  feedback: {
    title: 'Submit feedback before closing?',
    description:
      'You have unsent feedback. Select Submit Feedback before closing, otherwise your comments will be lost.',
    primaryActionLabel: 'Submit Feedback',
  },
} as const;

function getCloseReviewDialogContent(feedbackCount: number): CloseReviewDialogContent {
  return feedbackCount === 0 ? closeReviewDialogCopy.empty : closeReviewDialogCopy.feedback;
}

function getSubmitStatus(threads: CommentThread[], trimmedGlobal: string): AnnotationStatus {
  return getFeedbackCount(threads, trimmedGlobal) === 0 ? 'approved' : 'changes_requested';
}
