import { type RefObject, useLayoutEffect } from 'react';
import { findIterationChangeElement, isInlineChange } from './iterationChangeAnchors.tsx';
import type { IterationChange, IterationChangeKind } from './iterationChanges.tsx';

export interface IterationChangeHighlightsProps {
  contentRef: RefObject<HTMLDivElement | null>;
  changes: IterationChange[];
  activeChangeId?: string | null;
  onAnchorsResolved?: (anchoredChangeIds: Set<string>) => void;
  onChangeSelect?: (changeId: string) => void;
}

interface HighlightedElement {
  element: HTMLElement;
  handleClick?: () => void;
}

export function IterationChangeHighlights({
  contentRef,
  changes,
  activeChangeId = null,
  onAnchorsResolved,
  onChangeSelect,
}: IterationChangeHighlightsProps) {
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      onAnchorsResolved?.(new Set());
      return;
    }

    const highlighted: HighlightedElement[] = [];
    const anchoredChangeIds = new Set<string>();
    for (const change of changes) {
      if (!isInlineChange(change)) {
        continue;
      }
      const element = findIterationChangeElement(content, change);
      if (!element) {
        continue;
      }
      element.classList.add('cb-iteration-change-highlight', getChangeKindHighlightClass(change));
      element.classList.toggle('cb-iteration-change-highlight-active', change.id === activeChangeId);
      element.classList.toggle('cb-iteration-change-highlight-interactive', onChangeSelect !== undefined);
      element.dataset.iterationChangeId = change.id;
      element.dataset.iterationChangeKind = change.kind;
      const handleClick = onChangeSelect ? () => onChangeSelect(change.id) : undefined;
      if (handleClick) {
        element.addEventListener('click', handleClick);
      }
      highlighted.push({ element, handleClick });
      anchoredChangeIds.add(change.id);
    }

    onAnchorsResolved?.(anchoredChangeIds);

    return () => {
      for (const { element, handleClick } of highlighted) {
        element.classList.remove(
          'cb-iteration-change-highlight',
          'cb-iteration-change-highlight-active',
          'cb-iteration-change-highlight-interactive',
          'cb-iteration-change-highlight-added',
          'cb-iteration-change-highlight-modified',
          'cb-iteration-change-highlight-removed',
        );
        if (handleClick) {
          element.removeEventListener('click', handleClick);
        }
        delete element.dataset.iterationChangeId;
        delete element.dataset.iterationChangeKind;
      }
    };
  }, [activeChangeId, changes, contentRef, onAnchorsResolved, onChangeSelect]);

  return null;
}

function getChangeKindHighlightClass(change: { kind: IterationChangeKind }): string {
  if (change.kind === 'added') {
    return 'cb-iteration-change-highlight-added';
  }
  if (change.kind === 'removed') {
    return 'cb-iteration-change-highlight-removed';
  }
  return 'cb-iteration-change-highlight-modified';
}
