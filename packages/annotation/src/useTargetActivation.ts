import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { AnnotatableTarget, SelectableTextIndex } from './annotationTypes.ts';
import { findTokenSpan } from './codeTokenSnap.ts';

export function useTargetActivation(args: {
  enabled: boolean;
  container: HTMLElement | null;
  index: SelectableTextIndex | null;
  suppressNextActivationRef: RefObject<boolean>;
  onTargetSelect: (selection: { range: Range; target: AnnotatableTarget }) => void;
}): void {
  const { enabled, container, index, suppressNextActivationRef, onTargetSelect } = args;

  useEffect(() => {
    if (!enabled || !container || !index) {
      clearTargetActivationState(container);
      return;
    }

    const targetElements = Array.from(container.querySelectorAll<HTMLElement>('[data-target-id]'));
    for (const element of targetElements) {
      if (element.tabIndex < 0) {
        element.tabIndex = 0;
      }
    }

    let hoveredTargetId: string | null = null;

    const setHoveredTarget = (nextTargetId: string | null) => {
      if (hoveredTargetId === nextTargetId) {
        return;
      }

      if (hoveredTargetId) {
        const previous = container.querySelector<HTMLElement>(`[data-target-id="${hoveredTargetId}"]`);
        if (previous) {
          previous.dataset.targetState = 'idle';
        }
      }

      if (nextTargetId) {
        const next = container.querySelector<HTMLElement>(`[data-target-id="${nextTargetId}"]`);
        if (next) {
          next.dataset.targetState = 'hovered';
        }
      }

      hoveredTargetId = nextTargetId;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const target = getTargetFromNode(index, container, event.target);
      setHoveredTarget(target?.id ?? null);
    };

    const handlePointerLeave = () => {
      setHoveredTarget(null);
    };

    const activate = (event: Event, source: EventTarget | null, respectSuppression: boolean) => {
      const target = getTargetFromNode(index, container, source);
      if (!target) {
        return;
      }

      if (respectSuppression && suppressNextActivationRef.current) {
        suppressNextActivationRef.current = false;
        return;
      }

      if (shouldDeferToDefaultAction(source)) {
        return;
      }

      const range = resolveTokenRange(source, container) ?? index.targetToRange(target.id);
      if (!range) {
        return;
      }

      event.preventDefault();
      onTargetSelect({ range, target });
    };

    const handleClick = (event: MouseEvent) => {
      activate(event, event.target, true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      activate(event, document.activeElement, false);
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);
    container.addEventListener('click', handleClick);
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('keydown', handleKeyDown);
      setHoveredTarget(null);
      clearTargetActivationState(container);
    };
  }, [container, enabled, index, onTargetSelect, suppressNextActivationRef]);
}

function getTargetFromNode(
  index: SelectableTextIndex,
  container: HTMLElement,
  node: EventTarget | null,
): AnnotatableTarget | null {
  const element = node instanceof HTMLElement ? node : node instanceof Text ? node.parentElement : null;
  if (!element) {
    return null;
  }

  const targetElement = element.closest<HTMLElement>('[data-target-id]');
  if (!targetElement || !container.contains(targetElement)) {
    return null;
  }

  const targetId = targetElement.dataset.targetId;
  return targetId ? index.resolveTarget(targetId) : null;
}

function resolveTokenRange(source: EventTarget | null, container: HTMLElement): Range | null {
  if (!(source instanceof Node)) {
    return null;
  }
  const token = findTokenSpan(source, container);
  if (!token) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(token);
  return range;
}

function shouldDeferToDefaultAction(source: EventTarget | null): boolean {
  if (!(source instanceof Element)) {
    return false;
  }
  return isLink(source) && hasCollapsedSelection();
}

function isLink(element: Element): boolean {
  return element.closest('a[href]') !== null;
}

function hasCollapsedSelection(): boolean {
  const selection = window.getSelection();
  return !selection || selection.isCollapsed;
}

function clearTargetActivationState(container: HTMLElement | null): void {
  if (!container) {
    return;
  }

  const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-target-id]'));
  for (const element of elements) {
    delete element.dataset.targetState;
    element.removeAttribute('tabindex');
  }
}
