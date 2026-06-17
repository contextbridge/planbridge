import type {
  AnnotationTargetKind,
  CommentMessage,
  CommentThread,
  StoredAnnotationAnchor,
  TextAnnotationAnchor,
} from '@contextbridge/shared/annotationSchema';

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
    createdFrom: TextAnnotationAnchor['createdFrom'],
    explicitTarget?: HTMLElement,
  ): TextAnnotationAnchor;
  targetToRange(targetId: string): Range | null;
  restoreAnchor(anchor: TextAnnotationAnchor): Range | null;
  resolveTarget(targetId: string): AnnotatableTarget | null;
}

// The live draft body is tracked separately in useAnnotationState — deliberately not on this
// descriptor. Editing the body must not change this object's identity, because it flows through
// resolveAnnotationThreads into the CSS Custom Highlight + element-marker effects; a per-keystroke
// identity churn there rebuilds the whole highlight range and is pathologically slow in Firefox.
export type ActiveCommentDraft =
  | {
      kind: 'new-thread';
      anchor: StoredAnnotationAnchor;
    }
  | {
      kind: 'edit-comment';
      threadId: string;
      messageId: string;
      anchor: StoredAnnotationAnchor;
    };

export type AnnotationThreadComment =
  | {
      kind: 'saved';
      threadId: string;
      message: CommentMessage;
      isPrimary: true;
    }
  | {
      kind: 'draft';
      draft: ActiveCommentDraft;
      mode: 'new-thread' | 'edit-comment';
    };

export interface ResolvedAnnotationThread {
  id: string;
  anchor: StoredAnnotationAnchor;
  range: Range | null;
  target: AnnotatableTarget | null;
  unresolved: boolean;
  quote: string;
  comments: AnnotationThreadComment[];
}
