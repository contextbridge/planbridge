import { useHotkeys } from 'react-hotkeys-hook';
import type { ActiveCommentDraft, ResolvedAnnotationThread } from './annotationTypes.ts';

export type CommentNavigationDirection = 'next' | 'previous';

export interface UseCommentNavigationArgs {
  activeDraft: ActiveCommentDraft | null;
  threads: ResolvedAnnotationThread[];
  enabled: boolean;
  onActivateThread: (thread: ResolvedAnnotationThread) => void;
  onOpenThreadComment: (thread: ResolvedAnnotationThread) => void;
  selectedAnnotationId: string | null;
  submitted: boolean;
  targetDocument?: Document;
}

interface CommentNavigationState {
  activePosition: number;
  currentThread: ResolvedAnnotationThread | null;
  currentAnnotationId: string | null;
  navigateThread: (direction: CommentNavigationDirection) => void;
  navigableThreads: ResolvedAnnotationThread[];
  openCurrentThreadComment: () => void;
  total: number;
}

export function useCommentNavigation({
  activeDraft,
  threads,
  enabled,
  onActivateThread,
  onOpenThreadComment,
  selectedAnnotationId,
  submitted,
  targetDocument,
}: UseCommentNavigationArgs): CommentNavigationState {
  const navigableThreads = getNavigableThreads(threads);
  const currentThreadIndex = getCurrentThreadIndex(selectedAnnotationId, navigableThreads);
  const currentThread = navigableThreads[currentThreadIndex] ?? null;
  const currentAnnotationId = currentThread?.id ?? null;

  const navigateThread = (direction: CommentNavigationDirection) => {
    const nextIndex = getAdjacentThreadIndex(navigableThreads, currentThreadIndex, direction);
    const nextThread = navigableThreads[nextIndex];
    if (nextThread) {
      onActivateThread(nextThread);
    }
  };

  const openCurrentThreadComment = () => {
    if (!currentThread || submitted || activeDraft !== null) {
      return;
    }

    onOpenThreadComment(currentThread);
  };

  // Capture-phase so an ancestor calling stopPropagation (e.g. Storybook
  // decorators) cannot swallow J/K/C before navigation sees them.
  const shortcutOptions = {
    document: targetDocument,
    enabled: () => enabled && !submitted && activeDraft === null && navigableThreads.length > 0,
    ignoreEventWhen: (event: KeyboardEvent) => event.defaultPrevented,
    eventListenerOptions: { capture: true },
    preventDefault: true,
  };

  useHotkeys('j', () => navigateThread('next'), shortcutOptions, [
    activeDraft,
    enabled,
    navigableThreads.length,
    navigateThread,
    submitted,
  ]);

  useHotkeys('k', () => navigateThread('previous'), shortcutOptions, [
    activeDraft,
    enabled,
    navigableThreads.length,
    navigateThread,
    submitted,
  ]);

  useHotkeys('c', openCurrentThreadComment, shortcutOptions, [
    activeDraft,
    enabled,
    navigableThreads.length,
    openCurrentThreadComment,
    submitted,
  ]);

  return {
    activePosition: currentThreadIndex + 1,
    currentThread,
    currentAnnotationId,
    navigateThread,
    navigableThreads,
    openCurrentThreadComment,
    total: navigableThreads.length,
  };
}

function getNavigableThreads(threads: ResolvedAnnotationThread[]): ResolvedAnnotationThread[] {
  return threads.filter((thread) => !thread.unresolved && thread.range !== null && !isNewThreadDraftOnly(thread));
}

function isNewThreadDraftOnly(thread: ResolvedAnnotationThread): boolean {
  return (
    thread.comments.length === 1 && thread.comments[0]?.kind === 'draft' && thread.comments[0].mode === 'new-thread'
  );
}

function getCurrentThreadIndex(selectedId: string | null, threads: ResolvedAnnotationThread[]): number {
  if (threads.length === 0) {
    return -1;
  }

  if (selectedId === null) {
    return 0;
  }

  const index = threads.findIndex((thread) => thread.id === selectedId);
  return index === -1 ? 0 : index;
}

function getAdjacentThreadIndex(
  threads: ResolvedAnnotationThread[],
  currentIndex: number,
  direction: CommentNavigationDirection,
): number {
  if (threads.length === 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction === 'next' ? 0 : threads.length - 1;
  }

  const offset = direction === 'next' ? 1 : -1;
  return (currentIndex + offset + threads.length) % threads.length;
}
