import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElementTargets } from './useElementTargets.ts';

describe('useElementTargets', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('opens a new-thread draft with an element anchor when a tagged node is clicked', () => {
    const container = renderBlockContainer();
    const onOpenAnnotationCommentDraft = vi.fn();
    const onSelectAnnotationId = vi.fn();

    renderHook(() =>
      useElementTargets({
        activeAnnotationId: null,
        container,
        onOpenAnnotationCommentDraft,
        onSelectAnnotationId,
        resolvedThreads: [],
        submitted: false,
      }),
    );

    fireEvent.click(container.querySelector('[data-mermaid-node-id]')!);

    expect(onOpenAnnotationCommentDraft).toHaveBeenCalledTimes(1);
    expect(onOpenAnnotationCommentDraft.mock.calls[0]?.[0]).toMatchObject({
      kind: 'new-thread',
      anchor: { kind: 'element', contentType: 'mermaid', element: { id: 'login', descriptor: 'diagram node' } },
    });
    expect(onSelectAnnotationId).toHaveBeenCalledTimes(1);
  });

  it('does not open a draft once submitted', () => {
    const container = renderBlockContainer();
    const onOpenAnnotationCommentDraft = vi.fn();

    renderHook(() =>
      useElementTargets({
        activeAnnotationId: null,
        container,
        onOpenAnnotationCommentDraft,
        onSelectAnnotationId: vi.fn(),
        resolvedThreads: [],
        submitted: true,
      }),
    );

    fireEvent.click(container.querySelector('[data-mermaid-node-id]')!);

    expect(onOpenAnnotationCommentDraft).not.toHaveBeenCalled();
  });
});

function renderBlockContainer(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <div data-element-block data-element-block-id="mermaid:5" data-element-content-type="mermaid"
         data-src-start-line="5" data-src-end-line="9">
      <svg>
        <g class="node" data-mermaid-node-id="login" data-mermaid-label="Login"><rect></rect></g>
      </svg>
    </div>`;
  document.body.appendChild(container);
  return container;
}
