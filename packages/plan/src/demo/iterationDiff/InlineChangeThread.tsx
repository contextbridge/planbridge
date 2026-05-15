import { cn } from '@contextbridge/ui/lib/utils';
import { ArrowDown, PencilLine, Plus, Sparkles } from 'lucide-react';
import { type ReactNode } from 'react';
import type { IterationChange, IterationChangeKind } from './iterationChanges.ts';

export const inlineChangeThreadTestIds = {
  thread: (changeId: string) => `iteration-inline-thread-${changeId}`,
};

export interface InlineChangeThreadProps {
  change: IterationChange;
  isActive: boolean;
  onHoverChange: (hovered: boolean) => void;
}

const KIND_LABEL: Record<Exclude<IterationChangeKind, 'removed'>, string> = {
  modified: 'Modified',
  added: 'Added',
  reordered: 'Moved',
};

const KIND_ICON: Record<Exclude<IterationChangeKind, 'removed'>, ReactNode> = {
  modified: <PencilLine aria-hidden className="size-3" />,
  added: <Plus aria-hidden className="size-3" />,
  reordered: <ArrowDown aria-hidden className="size-3" />,
};

export function InlineChangeThread({ change, isActive, onHoverChange }: InlineChangeThreadProps) {
  if (change.kind === 'removed') {
    return null;
  }

  return (
    <div
      className={cn('mt-2 ml-6 border-l-2 pl-3 transition-colors', isActive ? 'border-chart-3' : 'border-chart-3/40')}
      data-testid={inlineChangeThreadTestIds.thread(change.id)}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="flex items-center gap-2 text-xs leading-5">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-chart-3/15 text-chart-3">
          <Sparkles aria-hidden className="size-3" />
        </span>
        <span className="font-semibold text-foreground/80">Assistant</span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {KIND_ICON[change.kind]}
          {KIND_LABEL[change.kind]}
        </span>
      </div>

      <p className="mt-1 text-sm leading-6 text-foreground/85">{change.summary}</p>

      {change.feedbackRef ? (
        <div className="mt-2 border-l-2 border-muted-foreground/30 bg-muted/40 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
            In response to {change.feedbackRef.author}
          </div>
          <div className="mt-1 text-sm italic leading-5 text-foreground/70">“{change.feedbackRef.body}”</div>
        </div>
      ) : null}
    </div>
  );
}
