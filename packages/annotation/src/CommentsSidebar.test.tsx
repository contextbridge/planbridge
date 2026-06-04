import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedAnnotationThread } from './annotationTypes.ts';
import { CommentsSidebar, type CommentsSidebarProps } from './CommentsSidebar.tsx';
import type { SubmissionState } from './SubmitBar.tsx';
import { resolvedAnnotationThread } from './testFactories.ts';

describe('CommentsSidebar', () => {
  const originalMatchMedia = window.matchMedia;
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView'];
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    cleanup();
    vi.restoreAllMocks();
  });

  it('scrolls the active card into view when the sidebar is docked', () => {
    stubDocked(true);
    const threads = [resolvedAnnotationThread.build({ id: 'thr_a' }), resolvedAnnotationThread.build({ id: 'thr_b' })];

    const { rerender } = render(<CommentsSidebar {...buildProps({ threads, currentThreadId: 'thr_a' })} />);
    scrollIntoView.mockClear();

    rerender(<CommentsSidebar {...buildProps({ threads, currentThreadId: 'thr_b' })} />);

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('does not scroll the page when the sidebar is stacked on small screens', () => {
    stubDocked(false);
    const threads = [resolvedAnnotationThread.build({ id: 'thr_a' }), resolvedAnnotationThread.build({ id: 'thr_b' })];

    const { rerender } = render(<CommentsSidebar {...buildProps({ threads, currentThreadId: 'thr_a' })} />);
    scrollIntoView.mockClear();

    rerender(<CommentsSidebar {...buildProps({ threads, currentThreadId: 'thr_b' })} />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

function stubDocked(matches: boolean): void {
  window.matchMedia = (query: string) =>
    ({
      media: query,
      matches,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
}

function buildSubmission(): SubmissionState {
  return {
    submit: async () => {},
    submitting: false,
    submitted: false,
    closeCountdownSeconds: null,
    error: null,
    label: 'Submit Feedback',
    feedbackCount: 0,
  };
}

function buildProps(
  overrides: Partial<CommentsSidebarProps> & { threads: ResolvedAnnotationThread[]; currentThreadId: string | null },
): CommentsSidebarProps {
  return {
    highlightedAnnotationId: null,
    globalComment: { body: '', setBody: () => {} },
    navigation: null,
    submission: buildSubmission(),
    onThreadClick: () => {},
    onAnnotationHoverChange: () => {},
    onDraftBodyChange: () => {},
    onDraftCancel: () => {},
    onDraftSave: () => {},
    onRequestRemove: () => {},
    ...overrides,
  };
}
