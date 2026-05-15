import { cn } from '@contextbridge/ui/lib/utils';
import { type RefObject, useLayoutEffect, useState } from 'react';
import type { IterationChange } from './iterationChanges.ts';

export const iterationChangeIndicatorTestIds = {
  container: 'iteration-change-indicators',
  dot: (changeId: string) => `iteration-change-indicator-${changeId}`,
};

interface IndicatorPosition {
  id: string;
  top: number;
}

export interface IterationChangeIndicatorsProps {
  contentRef: RefObject<HTMLDivElement | null>;
  changes: IterationChange[];
  activeChangeId: string | null;
  onActivate: (changeId: string) => void;
  onHoverChange: (changeId: string, hovered: boolean) => void;
}

export function IterationChangeIndicators({
  contentRef,
  changes,
  activeChangeId,
  onActivate,
  onHoverChange,
}: IterationChangeIndicatorsProps) {
  const [positions, setPositions] = useState<IndicatorPosition[]>([]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    const recompute = () => {
      const contentRect = content.getBoundingClientRect();
      const next: IndicatorPosition[] = [];
      for (const change of changes) {
        if (change.sourceLine === undefined) {
          continue;
        }
        const el = findChangedElement(content, change);
        if (!el) {
          continue;
        }
        const rect = el.getBoundingClientRect();
        next.push({
          id: change.id,
          top: rect.top - contentRect.top + rect.height / 2,
        });
      }
      setPositions(next);
    };

    recompute();

    const observer = new ResizeObserver(recompute);
    observer.observe(content);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [changes, contentRef]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-0"
      data-testid={iterationChangeIndicatorTestIds.container}
    >
      {positions.map((position) => (
        <button
          key={position.id}
          aria-label="Jump to change summary"
          className={cn(
            'cb-iteration-indicator pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-chart-3 transition-transform',
            activeChangeId === position.id ? 'size-3 scale-110' : 'size-2 hover:scale-110',
          )}
          data-testid={iterationChangeIndicatorTestIds.dot(position.id)}
          onClick={() => onActivate(position.id)}
          onMouseEnter={() => onHoverChange(position.id, true)}
          onMouseLeave={() => onHoverChange(position.id, false)}
          style={{ top: position.top, left: -6 }}
          type="button"
        />
      ))}
    </div>
  );
}

function findChangedElement(content: HTMLElement, change: IterationChange): HTMLElement | null {
  if (change.sourceLine === undefined) {
    return null;
  }
  const lineSelector = `[data-src-start-line="${change.sourceLine}"]`;
  const candidates = content.querySelectorAll<HTMLElement>(lineSelector);
  if (candidates.length === 0) {
    return null;
  }
  if (change.targetKind) {
    for (const candidate of candidates) {
      if (candidate.dataset.targetKind === change.targetKind) {
        return candidate;
      }
    }
  }
  return candidates[0] ?? null;
}
