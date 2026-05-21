import type { CommentThread, StoredAnnotationAnchor } from '@contextbridge/shared/annotationSchema';
import type { ActiveCommentDraft, ResolvedAnnotationThread, SelectableTextIndex } from './annotationTypes.ts';
import { isAnnotationCommentThread } from './annotationTypes.ts';
import { getPrimaryMessage } from './commentModel.ts';

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
    const range = textIndex.restoreAnchor(anchor);
    const targetId = anchor.target?.id ?? anchor.endpoints.start.targetId;
    const primaryMessage = getPrimaryMessage(thread);

    return [
      {
        id: thread.id,
        anchor,
        range,
        target: textIndex.resolveTarget(targetId),
        unresolved: range === null,
        quote: anchor.quote.exact,
        comments: [{ kind: 'saved', threadId: thread.id, message: primaryMessage, isPrimary: true }],
      },
    ];
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
  return `draft-annotation-${anchor.position.start}-${anchor.position.end}`;
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

  const draftRange = textIndex.restoreAnchor(activeDraft.anchor);
  const draftTargetId = activeDraft.anchor.target?.id ?? activeDraft.anchor.endpoints.start.targetId;
  return [
    ...items,
    {
      id: getNewThreadDraftId(activeDraft.anchor),
      anchor: activeDraft.anchor,
      range: draftRange,
      target: textIndex.resolveTarget(draftTargetId),
      unresolved: draftRange === null,
      quote: activeDraft.anchor.quote.exact,
      comments: [draftComment],
    },
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

  return left.anchor.position.start - right.anchor.position.start;
}
