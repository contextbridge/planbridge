import type { AnnotationSubmission, CommentThread } from '@contextbridge/shared/annotationSchema';
import { annotationAnchor, annotationThread } from '@contextbridge/shared/testFactories';
import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type RenderAnnotationHookResult, renderAnnotationHook } from './testHelpers/renderAnnotationHook.tsx';
import { useAnnotationState } from './useAnnotationState.ts';

afterEach(() => {
  cleanup();
});

describe('useAnnotationState', () => {
  describe('draft.save', () => {
    it('appends a new thread when the draft has no threadId', () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        result.current.draft.open({
          anchor: annotationAnchor.build(),
          body: '',
          getRect: () => null,
        });
      });

      act(() => {
        result.current.draft.setBody('Why this order?');
      });

      act(() => {
        result.current.draft.save();
      });

      expect(result.current.threads).toHaveLength(1);
      expect(result.current.threads[0]?.messages[0]?.body).toBe('Why this order?');
      expect(result.current.draft.active).toBeNull();
    });

    it('updates an existing thread when threadId is present', () => {
      const existing = annotationThread.build({ id: 'thr_existing_01' });
      const { result } = renderAnnotationHook(() => useAnnotationState({ initialThreads: [existing] }));

      act(() => {
        result.current.draft.open({
          threadId: 'thr_existing_01',
          anchor: annotationAnchor.build(),
          body: 'original body',
          getRect: () => null,
        });
      });

      act(() => {
        result.current.draft.setBody('revised body');
      });

      act(() => {
        result.current.draft.save();
      });

      expect(result.current.threads).toHaveLength(1);
      expect(result.current.threads[0]?.id).toBe('thr_existing_01');
      expect(result.current.threads[0]?.messages[0]?.body).toBe('revised body');
    });

    it('is a no-op when the body is whitespace-only', () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        result.current.draft.open({
          anchor: annotationAnchor.build(),
          body: '',
          getRect: () => null,
        });
      });

      act(() => {
        result.current.draft.setBody('   \n\t  ');
      });

      act(() => {
        result.current.draft.save();
      });

      expect(result.current.threads).toHaveLength(0);
      expect(result.current.draft.active).not.toBeNull();
    });
  });

  describe('submission.submit', () => {
    it('emits status "approved" when there are no threads and no global comment', async () => {
      const { result, submitAnnotation } = renderAnnotationHook(() => useAnnotationState({}));

      await act(async () => {
        await result.current.submission.submit();
      });

      expect(submitAnnotation).toHaveBeenCalledTimes(1);
      expect(submitAnnotation.mock.calls[0]?.[0]?.status).toBe('approved');
      expect(submitAnnotation.mock.calls[0]?.[0]?.threads).toEqual([]);
      expect(result.current.submission.submitted).toBe(true);
      expect(result.current.submission.closeCountdownSeconds).toBe(3);
    });

    it('emits status "changes_requested" when annotation threads exist', async () => {
      const { result, submitAnnotation } = renderAnnotationHook(() =>
        useAnnotationState({ initialThreads: [annotationThread.build({ id: 'thr_01' })] }),
      );

      await act(async () => {
        await result.current.submission.submit();
      });

      expect(submitAnnotation.mock.calls[0]?.[0]?.status).toBe('changes_requested');
    });

    it('bundles a non-empty global comment into the submission as a global thread', async () => {
      const { result, submitAnnotation } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        result.current.globalComment.setBody('Spell out rollback steps.');
      });

      await act(async () => {
        await result.current.submission.submit();
      });

      const submission = submitAnnotation.mock.calls[0]?.[0];
      expect(submission?.status).toBe('changes_requested');
      expect(submission?.threads).toHaveLength(1);
      expect(submission?.threads[0]?.subject.kind).toBe('global');
      expect(submission?.threads[0]?.messages[0]?.body).toBe('Spell out rollback steps.');
    });

    it('trims whitespace-only global comments out of the submission', async () => {
      const { result, submitAnnotation } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        result.current.globalComment.setBody('   \n\t  ');
      });

      await act(async () => {
        await result.current.submission.submit();
      });

      expect(submitAnnotation.mock.calls[0]?.[0]?.threads).toEqual([]);
    });

    it('captures the error message and leaves submitted=false on failure', async () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({}), {
        contextOverrides: {
          submitAnnotation: vi
            .fn<(submission: AnnotationSubmission) => Promise<void>>()
            .mockRejectedValue(new Error('network down')),
        },
      });

      await act(async () => {
        await result.current.submission.submit();
      });

      expect(result.current.submission.submitted).toBe(false);
      expect(result.current.submission.error).toBe('network down');
    });

    it('steps the countdown down and closes the window after the final tick', async () => {
      const { result, timers } = renderAnnotationHook(() => useAnnotationState({}));

      await act(async () => {
        await result.current.submission.submit();
      });
      expect(result.current.submission.closeCountdownSeconds).toBe(3);

      act(() => timers.advance());
      expect(result.current.submission.closeCountdownSeconds).toBe(2);

      act(() => timers.advance());
      expect(result.current.submission.closeCountdownSeconds).toBe(1);

      act(() => timers.advance());
      expect(timers.closeWindowCallCount).toBe(1);
    });

    it('cancels the pending auto-close when the hook unmounts', async () => {
      const { result, unmount, timers } = renderAnnotationHook(() => useAnnotationState({}));

      await act(async () => {
        await result.current.submission.submit();
      });

      unmount();

      expect(timers.clearedTimeoutIds).toEqual([1]);
      expect(timers.closeWindowCallCount).toBe(0);
    });
  });

  describe('initialThreads filtering', () => {
    it('drops any global threads seeded via initialThreads (use initialGlobalComment instead)', () => {
      const { result } = renderAnnotationHook(() =>
        useAnnotationState({
          initialThreads: [
            annotationThread.build({ id: 'thr_ann_seeded' }),
            {
              id: 'thr_global_seeded',
              subject: { kind: 'global' },
              messages: [
                {
                  id: 'msg_global',
                  author: { id: 'local-user', kind: 'user', displayName: 'You' },
                  body: 'ignored seed',
                  createdAt: '2026-04-20T12:34:56.000Z',
                },
              ],
            },
          ],
        }),
      );

      expect(result.current.threads).toHaveLength(1);
      expect(result.current.threads[0]?.id).toBe('thr_ann_seeded');
    });

    it('seeds the composer body from initialGlobalComment', () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({ initialGlobalComment: 'seeded comment' }));

      expect(result.current.globalComment.body).toBe('seeded comment');
      expect(result.current.submission.feedbackCount).toBe(1);
    });
  });

  describe('removal.confirm', () => {
    it('removes the pending thread and clears the pending id', () => {
      const thread = annotationThread.build({ id: 'thr_target' });
      const { result } = renderAnnotationHook(() => useAnnotationState({ initialThreads: [thread] }));

      act(() => {
        result.current.removal.request('thr_target');
      });

      act(() => {
        result.current.removal.confirm();
      });

      expect(result.current.threads).toHaveLength(0);
      expect(result.current.removal.pendingId).toBeNull();
    });

    it('clears the active draft when the removed thread matches the open draft', () => {
      const thread = annotationThread.build({ id: 'thr_target' });
      const originalBody = thread.messages[0]?.body ?? '';
      const { result } = renderAnnotationHook(() => useAnnotationState({ initialThreads: [thread] }));

      act(() => {
        result.current.draft.open({
          threadId: 'thr_target',
          anchor: annotationAnchor.build(),
          body: originalBody,
          getRect: () => null,
        });
        result.current.removal.request('thr_target');
      });

      act(() => {
        result.current.removal.confirm();
      });

      expect(result.current.draft.active).toBeNull();
    });
  });

  describe('draft.requestClose', () => {
    it('closes immediately when the draft body is empty', () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        openDraft(result);
      });

      act(() => {
        result.current.draft.requestClose();
      });

      expect(result.current.draft.active).toBeNull();
      expect(result.current.draft.discardDialogOpen).toBe(false);
    });

    it('closes immediately when the draft body is only whitespace', () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        openDraft(result, { body: '   ' });
      });

      act(() => {
        result.current.draft.requestClose();
      });

      expect(result.current.draft.active).toBeNull();
      expect(result.current.draft.discardDialogOpen).toBe(false);
    });

    it('opens the discard dialog when the new draft has content', () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        openDraft(result, { body: 'Some unsaved text' });
      });

      act(() => {
        result.current.draft.requestClose();
      });

      expect(result.current.draft.active).not.toBeNull();
      expect(result.current.draft.discardDialogOpen).toBe(true);
    });

    it('opens the discard dialog when an existing thread draft has been edited', () => {
      const thread = annotationThread.build({ id: 'thr_edit' });
      const originalBody = thread.messages[0]?.body ?? '';
      const { result } = renderAnnotationHook(() => useAnnotationState({ initialThreads: [thread] }));

      act(() => {
        openExistingDraft(result, thread, { body: originalBody + ' with edits' });
      });

      act(() => {
        result.current.draft.requestClose();
      });

      expect(result.current.draft.active).not.toBeNull();
      expect(result.current.draft.discardDialogOpen).toBe(true);
    });

    it('closes immediately when an existing thread draft has not been edited', () => {
      const thread = annotationThread.build({ id: 'thr_same' });
      const originalBody = thread.messages[0]?.body ?? '';
      const { result } = renderAnnotationHook(() => useAnnotationState({ initialThreads: [thread] }));

      act(() => {
        openExistingDraft(result, thread, { body: originalBody });
      });

      act(() => {
        result.current.draft.requestClose();
      });

      expect(result.current.draft.active).toBeNull();
      expect(result.current.draft.discardDialogOpen).toBe(false);
    });

    it('discards the draft when close is called after the dialog is shown', () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        openDraft(result, { body: 'Some text' });
      });

      act(() => {
        result.current.draft.requestClose();
      });

      expect(result.current.draft.discardDialogOpen).toBe(true);

      act(() => {
        result.current.draft.confirmDiscard();
      });

      expect(result.current.draft.active).toBeNull();
      expect(result.current.draft.discardDialogOpen).toBe(false);
    });

    it('keeps the draft open when dismissDiscardDialog is called', () => {
      const { result } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        openDraft(result, { body: 'Important feedback' });
      });

      act(() => {
        result.current.draft.requestClose();
      });

      expect(result.current.draft.discardDialogOpen).toBe(true);

      act(() => {
        result.current.draft.dismissDiscardDialog();
      });

      expect(result.current.draft.active).not.toBeNull();
      expect(result.current.draft.discardDialogOpen).toBe(false);
    });

    it('keeps the current draft until a replacement is explicitly confirmed', () => {
      const nextAnchor = annotationAnchor.build({
        endpoints: {
          start: { targetId: 'target_next', offset: 0 },
          end: { targetId: 'target_next', offset: 12 },
        },
      });
      const { result } = renderAnnotationHook(() => useAnnotationState({}));

      act(() => {
        openDraft(result, { body: 'Unsaved original' });
      });

      act(() => {
        result.current.draft.open({
          anchor: nextAnchor,
          body: 'replacement',
          getRect: () => null,
        });
      });

      expect(result.current.draft.active?.body).toBe('Unsaved original');
      expect(result.current.draft.discardDialogOpen).toBe(true);

      act(() => {
        result.current.draft.confirmDiscard();
      });

      expect(result.current.draft.active?.body).toBe('replacement');
      expect(result.current.draft.active?.anchor).toBe(nextAnchor);
      expect(result.current.draft.discardDialogOpen).toBe(false);
    });

    it('keeps unsaved edits before opening removal confirmation for the same thread', () => {
      const thread = annotationThread.build({ id: 'thr_remove_dirty' });
      const originalBody = thread.messages[0]?.body ?? '';
      const { result } = renderAnnotationHook(() => useAnnotationState({ initialThreads: [thread] }));

      act(() => {
        openExistingDraft(result, thread, { body: originalBody + ' edited' });
      });

      act(() => {
        result.current.removal.request('thr_remove_dirty');
      });

      expect(result.current.removal.pendingId).toBeNull();
      expect(result.current.draft.active?.body).toBe(originalBody + ' edited');
      expect(result.current.draft.discardDialogOpen).toBe(true);

      act(() => {
        result.current.draft.confirmDiscard();
      });

      expect(result.current.draft.active).toBeNull();
      expect(result.current.removal.pendingId).toBe('thr_remove_dirty');
    });
  });
});

type AnnotationHookResult = RenderAnnotationHookResult<ReturnType<typeof useAnnotationState>, unknown>['result'];

function openDraft(result: AnnotationHookResult, { body = '' }: { body?: string } = {}): void {
  result.current.draft.open({
    anchor: annotationAnchor.build(),
    body: '',
    getRect: () => null,
  });

  if (body.length > 0) {
    result.current.draft.setBody(body);
  }
}

function openExistingDraft(result: AnnotationHookResult, thread: CommentThread, options: { body: string }): void {
  result.current.draft.open({
    threadId: thread.id,
    anchor: annotationAnchor.build(),
    body: thread.messages[0]?.body ?? '',
    getRect: () => null,
  });
  result.current.draft.setBody(options.body);
}
