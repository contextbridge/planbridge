import type { CommentThread, StoredAnnotationAnchor } from '@contextbridge/shared/planReviewSchema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearAnnotationHighlights, syncAnnotationHighlights } from './annotationHighlights.ts';
import type { ResolvedAnnotation, SelectableTextIndex } from './annotationTypes.ts';
import { isAnnotationCommentThread } from './annotationTypes.ts';
import { snapRangeToTokenBoundaries } from './codeTokenSnap.ts';
import { getPrimaryMessage } from './commentModel.ts';
import { buildSelectableTextIndex } from './selectableTextIndex.ts';
import type { ActiveCommentDraft, OpenAnnotationCommentDraftArgs } from './usePlanReviewState.ts';
import { useTargetActivation } from './useTargetActivation.ts';

export interface UseAnnotationInteractionsArgs {
  threads: CommentThread[];
  submitted: boolean;
  activeDraft: ActiveCommentDraft | null;
  onOpenAnnotationCommentDraft: (args: OpenAnnotationCommentDraftArgs) => void;
}

export function useAnnotationInteractions({
  threads,
  submitted,
  activeDraft,
  onOpenAnnotationCommentDraft,
}: UseAnnotationInteractionsArgs) {
  const [planContainer, setPlanContainer] = useState<HTMLDivElement | null>(null);
  const [textIndex, setTextIndex] = useState<SelectableTextIndex | null>(null);
  const [activeAnnotationIdState, setActiveAnnotationId] = useState<string | null>(null);
  const suppressNextTargetActivationRef = useRef(false);

  const activeAnnotationId =
    activeAnnotationIdState && threads.some((thread) => thread.id === activeAnnotationIdState)
      ? activeAnnotationIdState
      : null;

  const setAnnotationHover = (annotationId: string, hovered: boolean) => {
    setActiveAnnotationId(hovered ? annotationId : null);
  };

  const handlePlanContainer = (node: HTMLDivElement | null) => {
    setPlanContainer(node);
    setTextIndex(node ? buildSelectableTextIndex(node) : null);
  };

  const resolvedAnnotations = computeResolvedAnnotations(textIndex, threads);

  const resolvedAnnotationsRef = useRef<ResolvedAnnotation[]>(resolvedAnnotations);
  useEffect(() => {
    resolvedAnnotationsRef.current = resolvedAnnotations;
  }, [resolvedAnnotations]);

  const draftAnchor = activeDraft?.anchor ?? null;
  const draftRange = draftAnchor && textIndex ? textIndex.restoreAnchor(draftAnchor) : null;

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
      anchor,
      body: '',
      getRect: makeAnchorRectGetter(textIndex, anchor),
    });
  };

  const editAnnotationComment = useCallback(
    (annotation: ResolvedAnnotation) => {
      if (submitted || !annotation.range || !textIndex) {
        return;
      }

      const anchor = annotation.thread.subject.anchor;
      onOpenAnnotationCommentDraft({
        threadId: annotation.thread.id,
        anchor,
        body: getPrimaryMessage(annotation.thread).body,
        getRect: makeAnchorRectGetter(textIndex, anchor),
      });
      setActiveAnnotationId(annotation.thread.id);
    },
    [onOpenAnnotationCommentDraft, submitted, textIndex],
  );

  useTargetActivation({
    enabled: activeDraft === null && !submitted,
    container: planContainer,
    index: textIndex,
    suppressNextActivationRef: suppressNextTargetActivationRef,
    onTargetSelect: ({ range, target }) => {
      openAnnotationCommentFromRange(range, 'element', target.element);
      clearSelection();
    },
  });

  useEffect(() => {
    syncAnnotationHighlights({
      annotations: resolvedAnnotations,
      activeAnnotationId,
      draftRange,
    });

    return () => {
      clearAnnotationHighlights();
    };
  }, [activeAnnotationId, draftRange, resolvedAnnotations]);

  useEffect(() => {
    if (!planContainer || submitted || activeDraft !== null) {
      return;
    }

    const handleClickCapture = (event: MouseEvent) => {
      const caret = caretFromPoint(event.clientX, event.clientY);
      if (!caret || !planContainer.contains(caret.node)) {
        return;
      }

      const hit = resolvedAnnotationsRef.current.find((annotation) =>
        rangeContainsPoint(annotation.range, caret.node, caret.offset),
      );
      if (!hit) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      suppressNextTargetActivationRef.current = true;
      editAnnotationComment(hit);
    };

    planContainer.addEventListener('click', handleClickCapture, true);
    return () => {
      planContainer.removeEventListener('click', handleClickCapture, true);
    };
  }, [activeDraft, editAnnotationComment, planContainer, submitted]);

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

  const focusAnnotationComment = (annotation: ResolvedAnnotation) => {
    if (submitted || annotation.unresolved) {
      return;
    }

    scrollAnnotationIntoView(annotation);
    editAnnotationComment(annotation);
  };

  return {
    activeAnnotationId,
    focusAnnotationComment,
    handlePlanContainer,
    handleSelectionCapture,
    resolvedAnnotations,
    setActiveAnnotationId,
    setAnnotationHover,
  };
}

function computeResolvedAnnotations(
  textIndex: SelectableTextIndex | null,
  threads: CommentThread[],
): ResolvedAnnotation[] {
  if (!textIndex) {
    return [];
  }

  const items: ResolvedAnnotation[] = [];
  for (const thread of threads) {
    if (!isAnnotationCommentThread(thread)) {
      continue;
    }

    const range = textIndex.restoreAnchor(thread.subject.anchor);
    const targetId = thread.subject.anchor.target?.id ?? thread.subject.anchor.endpoints.start.targetId;
    const target = textIndex.resolveTarget(targetId);

    items.push({
      thread,
      range,
      target,
      unresolved: range === null,
    });
  }

  return items;
}

function makeAnchorRectGetter(index: SelectableTextIndex, anchor: StoredAnnotationAnchor): () => DOMRect | null {
  return () => {
    const liveRange = index.restoreAnchor(anchor);
    return liveRange ? getRangeRect(liveRange) : null;
  };
}

function scrollAnnotationIntoView(annotation: ResolvedAnnotation): void {
  const focusElement =
    annotation.range?.startContainer instanceof Element
      ? annotation.range.startContainer
      : annotation.range?.startContainer.parentElement;
  focusElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getRangeRect(range: Range): DOMRect {
  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return rect;
  }

  const fallback = range.getClientRects()[0];
  return fallback ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
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
