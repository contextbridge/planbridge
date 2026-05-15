import { cn } from '@contextbridge/ui/lib/utils';
import { IterationChangeCard } from './IterationChangeCard.tsx';
import type { IterationChange } from './iterationChanges.ts';

export const iterationChangesSidebarTestIds = {
  container: 'iteration-changes-sidebar',
  removedSection: 'iteration-changes-removed',
};

export interface IterationChangesSidebarProps {
  removed: IterationChange[];
  iterationLabel: string;
}

export function IterationChangesSidebar({ removed, iterationLabel }: IterationChangesSidebarProps) {
  return (
    <aside
      className="sticky top-[4.25rem] flex max-h-[calc(100vh-4.25rem)] min-w-0 flex-col self-start"
      data-testid={iterationChangesSidebarTestIds.container}
    >
      <section className={cn(SIDEBAR_PANEL_CLASS, 'flex min-h-0 flex-1 flex-col gap-4')}>
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">Removed sections</h2>
          <span className="text-xs text-muted-foreground">{iterationLabel}</span>
        </header>
        <p className="text-xs leading-5 text-muted-foreground">
          Sections deleted in this iteration have no anchor in the document, so the assistant leaves the notes here.
        </p>

        <div
          className="flex-1 space-y-2 overflow-y-auto pr-1"
          data-testid={iterationChangesSidebarTestIds.removedSection}
        >
          {removed.map((change) => (
            <IterationChangeCard
              key={change.id}
              change={change}
              isActive={false}
              onClick={() => {}}
              onHoverChange={() => {}}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}

const SIDEBAR_PANEL_CLASS = 'rounded-md border border-border p-4';
