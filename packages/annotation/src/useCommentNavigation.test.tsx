import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedAnnotationThread } from './annotationTypes.ts';
import { resolvedAnnotationDraftThread, resolvedAnnotationThread } from './testFactories.ts';
import { useCommentNavigation } from './useCommentNavigation.ts';

describe('useCommentNavigation', () => {
  afterEach(() => {
    cleanup();
  });

  it('excludes unresolved or range-less threads from navigation', () => {
    renderCommentNavigationHarness({
      threads: [
        resolvedAnnotationThread.build({ id: 'thr_live' }),
        resolvedAnnotationThread.build({ id: 'thr_unresolved', unresolved: true }),
        resolvedAnnotationThread.build({ id: 'thr_range_less', range: null }),
      ],
    });

    expect(screen.getByTestId(commentNavigationTestIds.total)).toHaveTextContent('1');
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_live');
  });

  it('uses the selected thread as the current thread', () => {
    renderCommentNavigationHarness({
      threads: [
        resolvedAnnotationThread.build({ id: 'thr_first' }),
        resolvedAnnotationThread.build({ id: 'thr_second' }),
      ],
      selectedAnnotationId: 'thr_second',
    });

    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_second');
    expect(screen.getByTestId(commentNavigationTestIds.activePosition)).toHaveTextContent('2');
  });

  it('defaults to the first navigable thread when the selected id is null or stale', () => {
    const threads = [
      resolvedAnnotationThread.build({ id: 'thr_first' }),
      resolvedAnnotationThread.build({ id: 'thr_second' }),
    ];

    renderCommentNavigationHarness({ threads });
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_first');

    cleanup();
    renderCommentNavigationHarness({ threads, selectedAnnotationId: 'thr_missing' });
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_first');
  });

  it('has no current thread when the navigable list is empty', () => {
    renderCommentNavigationHarness({ threads: [] });

    expect(screen.getByTestId(commentNavigationTestIds.total)).toHaveTextContent('0');
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('none');
    expect(screen.getByTestId(commentNavigationTestIds.activePosition)).toHaveTextContent('0');
  });

  it('navigates from no current selection to the first or last thread', () => {
    const threads = [
      resolvedAnnotationThread.build({ id: 'thr_first' }),
      resolvedAnnotationThread.build({ id: 'thr_second' }),
    ];

    renderCommentNavigationHarness({ threads, selectedAnnotationId: 'thr_missing' });
    fireEvent.click(screen.getByTestId(commentNavigationTestIds.nextButton));
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_second');

    cleanup();
    renderCommentNavigationHarness({ threads, selectedAnnotationId: 'thr_missing' });
    fireEvent.click(screen.getByTestId(commentNavigationTestIds.previousButton));
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_second');
  });

  it('wraps next and previous navigation at list boundaries', () => {
    const threads = [
      resolvedAnnotationThread.build({ id: 'thr_first' }),
      resolvedAnnotationThread.build({ id: 'thr_second' }),
      resolvedAnnotationThread.build({ id: 'thr_third' }),
    ];

    renderCommentNavigationHarness({ threads, selectedAnnotationId: 'thr_third' });
    fireEvent.click(screen.getByTestId(commentNavigationTestIds.nextButton));
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_first');

    cleanup();
    renderCommentNavigationHarness({ threads, selectedAnnotationId: 'thr_first' });
    fireEvent.click(screen.getByTestId(commentNavigationTestIds.previousButton));
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_third');
  });

  it('excludes synthetic new-thread drafts from the navigable set', () => {
    renderCommentNavigationHarness({
      threads: [
        resolvedAnnotationThread.build({ id: 'thr_saved' }),
        resolvedAnnotationDraftThread.build({ id: 'draft-annotation-0-5' }),
      ],
    });

    expect(screen.getByTestId(commentNavigationTestIds.total)).toHaveTextContent('1');
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_saved');
  });

  it('handles keyboard shortcuts through the hook', () => {
    const onOpenThreadComment = vi.fn<(thread: ResolvedAnnotationThread) => void>();
    renderCommentNavigationHarness({
      threads: [
        resolvedAnnotationThread.build({ id: 'thr_first' }),
        resolvedAnnotationThread.build({ id: 'thr_second' }),
      ],
      onOpenThreadComment,
      selectedAnnotationId: 'thr_first',
    });

    fireEvent.keyDown(document.body, { key: 'j', code: 'KeyJ' });
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_second');

    fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK' });
    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_first');

    fireEvent.keyDown(document.body, { key: 'c', code: 'KeyC' });
    expect(onOpenThreadComment).toHaveBeenCalledOnce();
    expect(onOpenThreadComment.mock.calls[0]?.[0]?.id).toBe('thr_first');
  });

  it('ignores keyboard shortcuts while editing text', () => {
    const onOpenThreadComment = vi.fn<(thread: ResolvedAnnotationThread) => void>();
    renderCommentNavigationHarness({
      threads: [
        resolvedAnnotationThread.build({ id: 'thr_first' }),
        resolvedAnnotationThread.build({ id: 'thr_second' }),
      ],
      onOpenThreadComment,
    });

    fireEvent.keyDown(screen.getByTestId(commentNavigationTestIds.textInput), { key: 'j', code: 'KeyJ' });
    fireEvent.keyDown(screen.getByTestId(commentNavigationTestIds.textInput), { key: 'c', code: 'KeyC' });

    expect(screen.getByTestId(commentNavigationTestIds.currentAnnotationId)).toHaveTextContent('thr_first');
    expect(onOpenThreadComment).not.toHaveBeenCalled();
  });
});

const commentNavigationTestIds = {
  activePosition: 'comment-navigation-active-position',
  currentAnnotationId: 'comment-navigation-current-annotation-id',
  nextButton: 'comment-navigation-next',
  previousButton: 'comment-navigation-previous',
  textInput: 'comment-navigation-text-input',
  total: 'comment-navigation-total',
} as const;

function renderCommentNavigationHarness(props: CommentNavigationHarnessProps) {
  return render(<CommentNavigationHarness {...props} />);
}

function CommentNavigationHarness({
  threads,
  enabled = true,
  onOpenThreadComment = () => {},
  selectedAnnotationId = null,
  submitted = false,
}: CommentNavigationHarnessProps) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedAnnotationId);
  const navigation = useCommentNavigation({
    activeDraft: null,
    threads,
    enabled,
    onActivateThread: (thread) => {
      setSelectedId(thread.id);
    },
    onOpenThreadComment,
    selectedAnnotationId: selectedId,
    submitted,
    targetDocument: document,
  });

  return (
    <div>
      <div data-testid={commentNavigationTestIds.activePosition}>{navigation.activePosition}</div>
      <div data-testid={commentNavigationTestIds.currentAnnotationId}>{navigation.currentAnnotationId ?? 'none'}</div>
      <div data-testid={commentNavigationTestIds.total}>{navigation.total}</div>
      <button data-testid={commentNavigationTestIds.nextButton} onClick={() => navigation.navigateThread('next')}>
        Next
      </button>
      <button
        data-testid={commentNavigationTestIds.previousButton}
        onClick={() => navigation.navigateThread('previous')}
      >
        Previous
      </button>
      <input data-testid={commentNavigationTestIds.textInput} />
    </div>
  );
}

interface CommentNavigationHarnessProps {
  threads: ResolvedAnnotationThread[];
  enabled?: boolean;
  onOpenThreadComment?: (thread: ResolvedAnnotationThread) => void;
  selectedAnnotationId?: string | null;
  submitted?: boolean;
}
