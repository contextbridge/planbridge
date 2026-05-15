import { ChevronLeft, ChevronRight } from 'lucide-react';

export const iterationThreadNavigationBarTestIds = {
  container: 'iteration-thread-navigation-bar',
  previousButton: 'iteration-thread-navigation-previous',
  nextButton: 'iteration-thread-navigation-next',
};

export interface IterationThreadNavigationBarProps {
  activePosition: number;
  total: number;
  onNext: () => void;
  onPrevious: () => void;
}

export function IterationThreadNavigationBar({
  activePosition,
  total,
  onNext,
  onPrevious,
}: IterationThreadNavigationBarProps) {
  const disabled = total === 0;

  return (
    <nav
      aria-label="Comment thread navigation"
      className="sticky top-11 z-40 border-b border-border bg-background px-4 sm:px-6"
      data-testid={iterationThreadNavigationBarTestIds.container}
    >
      <div className="mx-auto flex h-10 max-w-[88rem] items-center justify-end gap-3 text-sm">
        <span className="text-xs text-muted-foreground">
          Thread <span className="tabular-nums text-foreground">{activePosition}</span> of{' '}
          <span className="tabular-nums text-foreground">{total}</span>
        </span>
        <div className="inline-flex overflow-hidden rounded-sm border border-border">
          <button
            aria-label="Previous comment thread"
            className="inline-flex items-center gap-1 border-r border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-background"
            data-testid={iterationThreadNavigationBarTestIds.previousButton}
            disabled={disabled}
            onClick={onPrevious}
            title="Previous comment thread (P)"
            type="button"
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            Previous <kbd className="font-mono text-[10px] text-muted-foreground">P</kbd>
          </button>
          <button
            aria-label="Next comment thread"
            className="inline-flex items-center gap-1 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-background"
            data-testid={iterationThreadNavigationBarTestIds.nextButton}
            disabled={disabled}
            onClick={onNext}
            title="Next comment thread (N)"
            type="button"
          >
            Next <kbd className="font-mono text-[10px] text-muted-foreground">N</kbd>
            <ChevronRight aria-hidden className="size-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
