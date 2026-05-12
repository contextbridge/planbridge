import type {
  AnnotationStatus,
  AnnotationSubmission,
  CommentThread,
  StoredAnnotationAnchor,
} from '@contextbridge/shared/annotationSchema';
import { getErrorMessage } from '@contextbridge/shared/errors';
import { useEffect, useState } from 'react';
import { isAnnotationCommentThread } from './annotationTypes.ts';
import type { DraftAnnotation } from './annotationTypes.ts';
import {
  createAnnotationCommentThread,
  createGlobalCommentThread,
  updateAnnotationThreadBody,
} from './commentModel.ts';
import { useAnnotationAppContext } from './useAppContext.ts';

export type ActiveCommentDraft = DraftAnnotation;

export interface UseAnnotationStateArgs {
  initialThreads?: CommentThread[];
  initialGlobalComment?: string;
}

export interface OpenAnnotationCommentDraftArgs {
  threadId?: string;
  anchor: StoredAnnotationAnchor;
  body: string;
  getRect: () => DOMRect | null;
}

export function useAnnotationState({ initialThreads, initialGlobalComment }: UseAnnotationStateArgs = {}) {
  const { submitAnnotation, scheduleTimeout, closeWindow, autoCloseDelaySeconds } = useAnnotationAppContext();

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

  const trimmedGlobal = globalCommentBody.trim();
  const feedbackCount = threads.length + (trimmedGlobal.length > 0 ? 1 : 0);
  const submitStatus: AnnotationStatus = feedbackCount === 0 ? 'approved' : 'changes_requested';
  const submitLabel = submitted ? 'Submitted' : feedbackCount === 0 ? 'Approve Plan' : 'Submit Feedback';

  const closeDraft = () => {
    setActiveDraft(null);
  };

  const openAnnotationCommentDraft = (draft: OpenAnnotationCommentDraftArgs) => {
    setActiveDraft({ ...draft });
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

    const threadId = activeDraft.threadId;
    if (threadId) {
      setThreads((current) => updateAnnotationThreadBody(current, threadId, nextBody));
    } else {
      setThreads((current) => [...current, createAnnotationCommentThread(activeDraft.anchor, nextBody)]);
    }
    closeDraft();
  };

  const removeComment = (threadId: string) => {
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    setActiveDraft((current) => (current?.threadId === threadId ? null : current));
  };

  const confirmRemove = () => {
    if (!pendingRemoveId) {
      return;
    }

    removeComment(pendingRemoveId);
    setPendingRemoveId(null);
  };

  const submit = async () => {
    if (submitting) {
      return;
    }

    const submissionThreads: CommentThread[] = [...threads];
    if (trimmedGlobal.length > 0) {
      submissionThreads.push(createGlobalCommentThread(trimmedGlobal));
    }

    const submission: AnnotationSubmission = {
      status: submitStatus,
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

  useEffect(() => {
    if (!submitted) {
      return;
    }

    let remaining = autoCloseDelaySeconds;
    let cancel: () => void = () => {};
    const tick = () => {
      if (remaining <= 1) {
        closeWindow();
        return;
      }
      remaining -= 1;
      setCloseCountdownSeconds(remaining);
      cancel = scheduleTimeout(tick, 1000);
    };
    cancel = scheduleTimeout(tick, 1000);

    return () => {
      cancel();
    };
  }, [autoCloseDelaySeconds, scheduleTimeout, closeWindow, submitted]);

  return {
    threads,
    draft: {
      active: activeDraft,
      open: openAnnotationCommentDraft,
      close: closeDraft,
      setBody: setDraftBody,
      save: saveDraft,
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
    removal: {
      pendingId: pendingRemoveId,
      request: setPendingRemoveId,
      confirm: confirmRemove,
    },
  };
}
