import type {
  CommentThread,
  ElementAnnotationAnchor,
  StoredAnnotationAnchor,
} from '@contextbridge/shared/annotationSchema';
import type { ActiveCommentDraft, ResolvedAnnotationThread, SelectableTextIndex } from './annotationTypes.ts';
import { isAnnotationCommentThread } from './annotationTypes.ts';
import { getPrimaryMessage } from './commentModel.ts';
import { adapterForContentType } from './element/ElementAdapter.ts';

export function isElementAnchor(anchor: StoredAnnotationAnchor): anchor is ElementAnnotationAnchor {
  return anchor.kind === 'element';
}

export function findElementAnchorTarget(container: HTMLElement, anchor: StoredAnnotationAnchor): Element | null {
  if (!isElementAnchor(anchor)) {
    return null;
  }
  return adapterForContentType(anchor.contentType)?.resolveTarget(container, anchor) ?? null;
}

export function resolveAnnotationThreads(
  textIndex: SelectableTextIndex | null,
  threads: CommentThread[],
  activeDraft: ActiveCommentDraft | null,
): ResolvedAnnotationThread[] {
  if (!textIndex) {
    return [];
  }

  const items = threads.flatMap<ResolvedAnnotationThread>((thread) => {
    if (!isAnnotationCommentThread(thread)) {
      return [];
    }

    const anchor = thread.subject.anchor;
    const primaryMessage = getPrimaryMessage(thread);
    const comments = [
      { kind: 'saved' as const, threadId: thread.id, message: primaryMessage, isPrimary: true as const },
    ];

    return [resolveThread({ id: thread.id, anchor, comments, textIndex })];
  });

  return withActiveDraftThread(textIndex, items, activeDraft).sort(compareResolvedThreads);
}

export function getDraftThreadId(draft: ActiveCommentDraft): string {
  if (draft.kind === 'edit-comment') {
    return draft.threadId;
  }

  return getNewThreadDraftId(draft.anchor);
}

export function getNewThreadDraftId(anchor: StoredAnnotationAnchor): string {
  if (anchor.kind === 'text') {
    return `draft-annotation-${anchor.position.start}-${anchor.position.end}`;
  }

  return `draft-annotation-element-${anchor.blockTargetId}-${anchor.element.id ?? anchor.element.descriptor}`;
}

// Resolves one stored anchor into the runtime thread shape the UI renders. The two arms are the
// two annotation mechanisms (text-range vs element); the element arm is content-type-agnostic —
// the only adapter-specific work (finding the DOM element) is deferred to focus/marker time.
function resolveThread(args: {
  id: string;
  anchor: StoredAnnotationAnchor;
  comments: ResolvedAnnotationThread['comments'];
  textIndex: SelectableTextIndex;
}): ResolvedAnnotationThread {
  const { id, anchor, comments, textIndex } = args;

  if (anchor.kind === 'text') {
    const range = textIndex.restoreAnchor(anchor);
    const targetId = anchor.target?.id ?? anchor.endpoints.start.targetId;
    return {
      id,
      anchor,
      range,
      target: textIndex.resolveTarget(targetId),
      unresolved: range === null,
      quote: anchor.quote.exact,
      comments,
    };
  }

  return {
    id,
    anchor,
    range: null,
    target: null,
    unresolved: false,
    quote: anchor.element.label,
    comments,
  };
}

function withActiveDraftThread(
  textIndex: SelectableTextIndex,
  items: ResolvedAnnotationThread[],
  activeDraft: ActiveCommentDraft | null,
): ResolvedAnnotationThread[] {
  if (!activeDraft) {
    return items;
  }

  const draftComment = { kind: 'draft' as const, draft: activeDraft, mode: activeDraft.kind };
  if (activeDraft.kind === 'edit-comment') {
    return items.map((thread) =>
      thread.id === activeDraft.threadId ? { ...thread, comments: [draftComment] } : thread,
    );
  }

  return [
    ...items,
    resolveThread({
      id: getNewThreadDraftId(activeDraft.anchor),
      anchor: activeDraft.anchor,
      comments: [draftComment],
      textIndex,
    }),
  ];
}

function compareResolvedThreads(left: ResolvedAnnotationThread, right: ResolvedAnnotationThread): number {
  if (left.range && right.range) {
    const order = left.range.compareBoundaryPoints(Range.START_TO_START, right.range);
    if (order !== 0) {
      return order;
    }
  }

  if (left.range && !right.range) {
    return -1;
  }

  if (!left.range && right.range) {
    return 1;
  }

  // Range-less threads (element anchors) order by source line, which tracks document order,
  // before falling back to a per-anchor secondary key.
  const lineOrder = left.anchor.sourceLines.start - right.anchor.sourceLines.start;
  if (lineOrder !== 0) {
    return lineOrder;
  }

  return secondaryOrderKey(left.anchor) - secondaryOrderKey(right.anchor);
}

/**
 * Stable tiebreaker for two threads that share a start line (e.g. comments on different nodes of the
 * same diagram). Text anchors order by character offset; element anchors have none, so hash their id.
 */
function secondaryOrderKey(anchor: StoredAnnotationAnchor): number {
  if (anchor.kind === 'text') {
    return anchor.position.start;
  }
  return stableOffset(`${anchor.blockTargetId}:${anchor.element.id ?? anchor.element.descriptor}`);
}

/** Hashes a string to a small, stable number — used only to keep equal-line anchors in a fixed order. */
function stableOffset(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1_000_000;
  }
  return hash;
}
