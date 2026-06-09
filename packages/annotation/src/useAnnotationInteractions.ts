import type { CommentThread } from '@contextbridge/shared/annotationSchema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { clearAnnotationHighlights, syncAnnotationHighlights } from './annotationHighlights.ts';
import {
  findElementAnchorTarget,
  getDraftThreadId,
  getNewThreadDraftId,
  isElementAnchor,
  resolveAnnotationThreads,
} from './annotationResolvers.ts';
import type { ActiveCommentDraft, ResolvedAnnotationThread, SelectableTextIndex } from './annotationTypes.ts';
import { snapRangeToTokenBoundaries } from './codeTokenSnap.ts';
import { useElementTargets } from './element/useElementTargets.ts';
import { buildSelectableTextIndex } from './selectableTextIndex.ts';
import type { OpenAnnotationCommentDraftArgs } from './useAnnotationState.ts';
import { useCommentNavigation } from './useCommentNavigation.ts';
import { useTargetActivation } from './useTargetActivation.ts';

export interface UseAnnotationInteractionsArgs {
  threads: CommentThread[];
  submitted: boolean;
  activeDraft: ActiveCommentDraft | null;
  onOpenAnnotationCommentDraft: (args: OpenAnnotationCommentDraftArgs) => void;
  onRequestCloseAnnotationCommentDraft: () => void;
}

export function useAnnotationInteractions({
  threads,
  submitted,
  activeDraft,
  onOpenAnnotationCommentDraft,
  onRequestCloseAnnotationCommentDraft,
}: UseAnnotationInteractionsArgs) {
  const [planContainer, setPlanContainer] = useState<HTMLDivElement | null>(null);
  const [textIndex, setTextIndex] = useState<SelectableTextIndex | null>(null);
  const [selectedAnnotationIdState, setSelectedAnnotationId] = useState<string | null>(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const suppressNextTargetActivationRef = useRef(false);

  const setAnnotationHover = (annotationId: string, hovered: boolean) => {
    setHoveredAnnotationId((current) => {
      if (hovered) {
        return annotationId;
      }

      return current === annotationId ? null : current;
    });
  };

  const handlePlanContainer = (node: HTMLDivElement | null) => {
    setPlanContainer(node);
    setTextIndex(node ? buildSelectableTextIndex(node) : null);
  };

  const resolvedThreads = resolveAnnotationThreads(textIndex, threads, activeDraft);
  const hotkeyDocument = planContainer?.ownerDocument;
  const activeDraftThreadId = activeDraft ? getDraftThreadId(activeDraft) : null;

  const resolvedThreadsRef = useRef<ResolvedAnnotationThread[]>(resolvedThreads);
  useEffect(() => {
    resolvedThreadsRef.current = resolvedThreads;
  }, [resolvedThreads]);

  const draftAnchor = activeDraft?.anchor ?? null;
  // Only text anchors resolve to a DOM range; element drafts (e.g. a diagram node) are marked
  // by their adapter, not range-highlighted, so they have no draft range.
  const draftRange = draftAnchor?.kind === 'text' && textIndex ? textIndex.restoreAnchor(draftAnchor) : null;

  const openAnnotationCommentFromRange = (
    range: Range,
    createdFrom: 'drag' | 'element',
    targetElement?: HTMLElement,
  ) => {
    if (!textIndex) {
      return;
    }

    const anchor = textIndex.rangeToAnchor(range, createdFrom, targetElement);
    onOpenAnnotationCommentDraft({
      kind: 'new-thread',
      anchor,
    });
    setSelectedAnnotationId(getNewThreadDraftId(anchor));
  };

  const editAnnotationComment = useCallback(
    (thread: ResolvedAnnotationThread) => {
      // Element anchors (no range) are still editable — they're located via their adapter.
      if (submitted || !textIndex || (!thread.range && !isElementAnchor(thread.anchor))) {
        return;
      }

      const savedComment = thread.comments.find((comment) => comment.kind === 'saved');
      if (!savedComment) {
        return;
      }

      onOpenAnnotationCommentDraft({
        kind: 'edit-comment',
        threadId: thread.id,
        messageId: savedComment.message.id,
        anchor: thread.anchor,
        body: savedComment.message.body,
      });
      setSelectedAnnotationId(thread.id);
    },
    [onOpenAnnotationCommentDraft, submitted, textIndex],
  );

  useTargetActivation({
    enabled: !submitted,
    container: planContainer,
    index: textIndex,
    suppressNextActivationRef: suppressNextTargetActivationRef,
    onTargetSelect: ({ range, target }) => {
      openAnnotationCommentFromRange(range, 'element', target.element);
      clearSelection();
    },
  });

  const activateThread = (thread: ResolvedAnnotationThread) => {
    setHoveredAnnotationId(null);
    setSelectedAnnotationId(thread.id);
    scrollThreadIntoView(thread, planContainer);
  };

  const openThreadComment = (thread: ResolvedAnnotationThread) => {
    scrollThreadIntoView(thread, planContainer);
    editAnnotationComment(thread);
  };

  const {
    activePosition,
    currentAnnotationId,
    navigateThread,
    openCurrentThreadComment,
    total: navigableAnnotationCount,
  } = useCommentNavigation({
    activeDraft,
    threads: resolvedThreads,
    enabled: true,
    onActivateThread: activateThread,
    onOpenThreadComment: openThreadComment,
    selectedAnnotationId: selectedAnnotationIdState,
    submitted,
    targetDocument: hotkeyDocument,
  });

  const validHoveredAnnotationId = resolvedThreads.some((thread) => thread.id === hoveredAnnotationId)
    ? hoveredAnnotationId
    : null;
  const highlightedAnnotationId = activeDraftThreadId ?? validHoveredAnnotationId ?? currentAnnotationId;

  useEffect(() => {
    syncAnnotationHighlights({
      threads: resolvedThreads,
      activeAnnotationId: highlightedAnnotationId,
      draftRange,
    });

    return () => {
      clearAnnotationHighlights();
    };
  }, [draftRange, highlightedAnnotationId, resolvedThreads]);

  // The other annotation mechanism: element-anchored content (diagrams, …) routes its clicks and
  // markers through a per-content-type adapter. Text selection stays the path above.
  useElementTargets({
    activeAnnotationId: highlightedAnnotationId,
    container: planContainer,
    onOpenAnnotationCommentDraft,
    onSelectAnnotationId: setSelectedAnnotationId,
    resolvedThreads,
    submitted,
  });

  useEffect(() => {
    if (!planContainer || submitted) {
      return;
    }

    const handleClickCapture = (event: MouseEvent) => {
      const caret = caretFromPoint(event.clientX, event.clientY);
      if (!caret || !planContainer.contains(caret.node)) {
        return;
      }

      const hit = resolvedThreadsRef.current.find((thread) =>
        rangeContainsPoint(thread.range, caret.node, caret.offset),
      );
      if (!hit) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      suppressNextTargetActivationRef.current = true;
      setSelectedAnnotationId(hit.id);
      editAnnotationComment(hit);
    };

    planContainer.addEventListener('click', handleClickCapture, true);
    return () => {
      planContainer.removeEventListener('click', handleClickCapture, true);
    };
  }, [editAnnotationComment, planContainer, submitted]);

  useHotkeys(
    'escape',
    (event) => {
      event.stopPropagation();
      onRequestCloseAnnotationCommentDraft();
    },
    {
      document: hotkeyDocument,
      enabled: (event) => !event.defaultPrevented && activeDraft !== null,
      enableOnContentEditable: true,
      enableOnFormTags: true,
      preventDefault: true,
    },
    [activeDraft, hotkeyDocument, onRequestCloseAnnotationCommentDraft],
  );

  const handleSelectionCapture = () => {
    if (submitted || !textIndex || !planContainer) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!planContainer.contains(range.commonAncestorContainer) || range.toString().trim().length === 0) {
      return;
    }

    suppressNextTargetActivationRef.current = true;
    openAnnotationCommentFromRange(snapRangeToTokenBoundaries(range, planContainer), 'drag');
    clearSelection();
  };

  const focusAnnotationThread = (thread: ResolvedAnnotationThread) => {
    if (submitted || thread.unresolved) {
      return;
    }

    setSelectedAnnotationId(thread.id);
    scrollThreadIntoView(thread, planContainer);
    editAnnotationComment(thread);
  };

  return {
    currentAnnotationId,
    currentSidebarThreadId: activeDraftThreadId ?? currentAnnotationId,
    highlightedAnnotationId,
    focusAnnotationThread,
    handlePlanContainer,
    handleSelectionCapture,
    navigation: {
      activePosition,
      next: () => navigateThread('next'),
      openCurrent: openCurrentThreadComment,
      previous: () => navigateThread('previous'),
      total: navigableAnnotationCount,
    },
    resolvedThreads,
    setAnnotationHover,
  };
}

function scrollThreadIntoView(thread: ResolvedAnnotationThread, container: HTMLElement | null): void {
  const rangeElement =
    thread.range?.startContainer instanceof Element
      ? thread.range.startContainer
      : thread.range?.startContainer.parentElement;
  const focusElement =
    rangeElement ??
    (container && isElementAnchor(thread.anchor) ? findElementAnchorTarget(container, thread.anchor) : null);
  focusElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearSelection(): void {
  const selection = window.getSelection();
  selection?.removeAllRanges();
}

function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const position = document.caretPositionFromPoint(x, y);
  return position ? { node: position.offsetNode, offset: position.offset } : null;
}

function rangeContainsPoint(range: Range | null, node: Node, offset: number): boolean {
  if (!range) {
    return false;
  }

  try {
    return range.comparePoint(node, offset) === 0;
  } catch {
    return false;
  }
}
