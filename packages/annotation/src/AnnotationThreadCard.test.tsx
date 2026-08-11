import '@contextbridge/ui/styles.css';
import { commentMessage } from '@contextbridge/shared/testFactories';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnotationThreadCard, annotationThreadCardTestIds } from './AnnotationThreadCard.tsx';
import { resolvedAnnotationThread } from './testFactories.ts';

describe('AnnotationThreadCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a saved comment body across the lines the author typed', () => {
    const singleLine = renderSavedComment({ id: 'msg_single', body: 'Foo' });
    const multiLine = renderSavedComment({ id: 'msg_multi', body: 'Foo\n\nBar\n\nBaz' });

    expect(multiLine.getBoundingClientRect().height).toBeGreaterThan(singleLine.getBoundingClientRect().height * 2);
  });
});

function renderSavedComment({ id, body }: { id: string; body: string }): HTMLElement {
  const message = commentMessage.build({ id, body });
  const thread = resolvedAnnotationThread.build({
    id: `thr_${id}`,
    comments: [{ kind: 'saved', threadId: `thr_${id}`, message, isPrimary: true }],
  });

  render(
    <AnnotationThreadCard
      draftBody=""
      isActive={false}
      isCurrent={false}
      onClick={vi.fn()}
      onDraftBodyChange={vi.fn()}
      onDraftCancel={vi.fn()}
      onDraftSave={vi.fn()}
      onHoverChange={vi.fn()}
      onRequestRemove={vi.fn()}
      submitted={false}
      thread={thread}
    />,
  );

  return screen.getByTestId(annotationThreadCardTestIds.comment(message.id));
}
