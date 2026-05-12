import {
  type CommentMessage,
  type CommentThread,
  type StoredAnnotationAnchor,
} from '@contextbridge/shared/annotationSchema';
import { instantToString, nowInstant } from '@contextbridge/shared/time';
import type { AnnotationCommentThread } from './annotationTypes.ts';

const LOCAL_AUTHOR = {
  id: 'local-user',
  kind: 'user' as const,
  displayName: 'You',
};

export function createAnnotationCommentThread(anchor: StoredAnnotationAnchor, body: string): AnnotationCommentThread {
  return {
    id: createId('thr_annotation'),
    subject: {
      kind: 'annotation',
      anchor,
    },
    messages: [createMessage(body)],
  };
}

export function createGlobalCommentThread(body: string): CommentThread {
  return {
    id: createId('thr_global'),
    subject: { kind: 'global' },
    messages: [createMessage(body)],
  };
}

export function getPrimaryMessage(thread: CommentThread): CommentMessage {
  const message = thread.messages[0];
  if (!message) {
    throw new Error(`thread ${thread.id} is missing its primary message`);
  }
  return message;
}

export function updateAnnotationThreadBody(threads: CommentThread[], threadId: string, body: string): CommentThread[] {
  return threads.map((thread) => (thread.id === threadId ? replaceThreadBody(thread, body) : thread));
}

function replaceThreadBody(thread: CommentThread, body: string): CommentThread {
  const [primaryMessage, ...rest] = thread.messages;
  if (!primaryMessage) {
    return thread;
  }

  return {
    ...thread,
    messages: [{ ...primaryMessage, body }, ...rest],
  };
}

function createId(prefix: 'thr_global' | 'thr_annotation' | 'msg'): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function createMessage(body: string): CommentMessage {
  return {
    id: createId('msg'),
    author: LOCAL_AUTHOR,
    body,
    createdAt: instantToString(nowInstant()),
  };
}
