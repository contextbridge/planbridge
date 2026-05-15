import { cn } from '@contextbridge/ui/lib/utils';
import { ArrowDown, MinusCircle, PencilLine, Plus, Sparkles } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import type { IterationChange, IterationChangeKind } from './iterationChanges.ts';

export const iterationChangeCardTestIds = {
  card: (changeId: string) => `iteration-change-card-${changeId}`,
};

export interface IterationChangeCardProps {
  change: IterationChange;
  isActive: boolean;
  onClick: () => void;
  onHoverChange: (hovered: boolean) => void;
}

const KIND_LABEL: Record<IterationChangeKind, string> = {
  modified: 'Modified',
  added: 'Added',
  removed: 'Removed',
  reordered: 'Moved',
};

const KIND_ICON: Record<IterationChangeKind, ReactNode> = {
  modified: <PencilLine aria-hidden className="size-3.5" />,
  added: <Plus aria-hidden className="size-3.5" />,
  removed: <MinusCircle aria-hidden className="size-3.5" />,
  reordered: <ArrowDown aria-hidden className="size-3.5" />,
};

export function IterationChangeCard({ change, isActive, onClick, onHoverChange }: IterationChangeCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isRemoved = change.kind === 'removed';

  return (
    <div
      ref={ref}
      className={cn(
        'relative rounded-md border border-l-2 px-3 py-3 transition',
        isRemoved ? 'border-l-muted-foreground/60' : 'border-l-chart-3/70',
        isActive ? 'border-chart-3/70 bg-chart-3/5' : 'border-border bg-background hover:border-chart-3/40',
        isRemoved ? 'cursor-default' : 'cursor-pointer',
      )}
      data-testid={iterationChangeCardTestIds.card(change.id)}
      onClick={() => {
        if (isRemoved) {
          return;
        }
        onClick();
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !isRemoved) {
          event.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      role={isRemoved ? undefined : 'button'}
      tabIndex={isRemoved ? -1 : 0}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Sparkles aria-hidden className="size-3.5 text-chart-3" />
        <span>Assistant</span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1 text-foreground/70">
          {KIND_ICON[change.kind]}
          {KIND_LABEL[change.kind]}
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-foreground/90">{change.summary}</p>

      {change.feedbackRef ? (
        <div className="mt-3 border-l-2 border-muted-foreground/30 pl-3 text-xs leading-5 text-muted-foreground">
          <div className="font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
            In response to {change.feedbackRef.author}
          </div>
          <div className="mt-1 italic text-foreground/70">“{change.feedbackRef.body}”</div>
        </div>
      ) : null}
    </div>
  );
}
