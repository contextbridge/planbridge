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

export type ActiveCommentDraft =
  | {
      kind: 'new-thread';
      anchor: StoredAnnotationAnchor;
      body: string;
    }
  | {
      kind: 'edit-comment';
      threadId: string;
      messageId: string;
      anchor: StoredAnnotationAnchor;
      body: string;
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
