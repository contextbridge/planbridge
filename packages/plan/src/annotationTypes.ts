import type {
  AnnotationTargetKind,
  CommentThread,
  StoredAnnotationAnchor,
} from '@contextbridge/shared/planReviewSchema';

export type AnnotationCommentThread = CommentThread & {
  subject: {
    kind: 'annotation';
    anchor: StoredAnnotationAnchor;
  };
};

export function isAnnotationCommentThread(thread: CommentThread): thread is AnnotationCommentThread {
  return thread.subject.kind === 'annotation';
}

export interface AnnotatableTarget {
  id: string;
  key: string;
  kind: AnnotationTargetKind;
  label: string;
  text: string;
  element: HTMLElement;
}

export interface SelectableTextIndex {
  container: HTMLElement;
  fullText: string;
  targets: Map<string, AnnotatableTarget>;
  rangeToAnchor(
    range: Range,
    createdFrom: StoredAnnotationAnchor['createdFrom'],
    explicitTarget?: HTMLElement,
  ): StoredAnnotationAnchor;
  targetToRange(targetId: string): Range | null;
  restoreAnchor(anchor: StoredAnnotationAnchor): Range | null;
  resolveTarget(targetId: string): AnnotatableTarget | null;
}

export interface DraftAnnotation {
  threadId?: string;
  anchor: StoredAnnotationAnchor;
  body: string;
  getRect: () => DOMRect | null;
}

export interface ResolvedAnnotation {
  thread: AnnotationCommentThread;
  range: Range | null;
  target: AnnotatableTarget | null;
  unresolved: boolean;
}
