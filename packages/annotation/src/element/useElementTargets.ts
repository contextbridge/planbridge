import { useEffect, useState } from 'react';
import { getNewThreadDraftId } from '../annotationResolvers.ts';
import type { ResolvedAnnotationThread } from '../annotationTypes.ts';
import type { OpenAnnotationCommentDraftArgs } from '../useAnnotationState.ts';
import { elementAdapterForContentType, elementAdapters } from './ElementAdapter.ts';
import { ELEMENT_RENDERED_EVENT, elementBlockAttrs } from './elementBlock.ts';

export interface UseElementTargetsArgs {
  activeAnnotationId: string | null;
  container: HTMLElement | null;
  onOpenAnnotationCommentDraft: (args: OpenAnnotationCommentDraftArgs) => void;
  onSelectAnnotationId: (annotationId: string) => void;
  resolvedThreads: ResolvedAnnotationThread[];
  submitted: boolean;
}

/**
 * Routes clicks and marker passes for element-anchored annotations to the adapter that owns each
 * block, keyed off the block-level contract (`data-element-block-id` / `data-element-content-type`).
 * A single instance serves every registered adapter.
 */
export function useElementTargets({
  activeAnnotationId,
  container,
  onOpenAnnotationCommentDraft,
  onSelectAnnotationId,
  resolvedThreads,
  submitted,
}: UseElementTargetsArgs): void {
  const [elementVersion, setElementVersion] = useState(0);

  // Adapters tag their SVG after an async render, outside React's control, so re-apply markers
  // when a block signals it is in the DOM.
  useEffect(() => {
    if (!container) return;
    const handleRendered = () => setElementVersion((version) => version + 1);
    container.addEventListener(ELEMENT_RENDERED_EVENT, handleRendered);
    return () => container.removeEventListener(ELEMENT_RENDERED_EVENT, handleRendered);
  }, [container]);

  useEffect(() => {
    if (!container) return;
    for (const adapter of elementAdapters) {
      adapter.applyMarkers({ container, threads: resolvedThreads, activeAnnotationId });
    }
    return () => {
      for (const adapter of elementAdapters) {
        adapter.applyMarkers({ container, threads: [], activeAnnotationId: null });
      }
    };
  }, [activeAnnotationId, container, elementVersion, resolvedThreads]);

  useEffect(() => {
    if (!container || submitted) return;

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const block = event.target.closest<HTMLElement>(`[${elementBlockAttrs.blockId}]`);
      if (!block || !container.contains(block)) return;

      const adapter = elementAdapterForContentType(block.getAttribute(elementBlockAttrs.contentType) ?? '');
      const anchor = adapter?.buildAnchor(block, event.target);
      if (!anchor) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onOpenAnnotationCommentDraft({ kind: 'new-thread', anchor });
      onSelectAnnotationId(getNewThreadDraftId(anchor));
    };

    container.addEventListener('click', handleClick, true);
    return () => container.removeEventListener('click', handleClick, true);
  }, [container, onOpenAnnotationCommentDraft, onSelectAnnotationId, submitted]);
}
