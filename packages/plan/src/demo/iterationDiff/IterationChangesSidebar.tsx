import { cn } from '@contextbridge/ui/lib/utils';
import { IterationChangeCard } from './IterationChangeCard.tsx';
import type { IterationChange } from './iterationChanges.ts';

export const iterationChangesSidebarTestIds = {
  container: 'iteration-changes-sidebar',
  docLevelSection: 'iteration-changes-doc-level',
};

export interface IterationChangesSidebarProps {
  docLevelChanges: IterationChange[];
  iterationLabel: string;
}

export function IterationChangesSidebar({ docLevelChanges, iterationLabel }: IterationChangesSidebarProps) {
  return (
    <aside
      className="sticky top-[4.25rem] flex max-h-[calc(100vh-4.25rem)] min-w-0 flex-col self-start"
      data-testid={iterationChangesSidebarTestIds.container}
    >
      <section className={cn(SIDEBAR_PANEL_CLASS, 'flex min-h-0 flex-1 flex-col gap-4')}>
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">Document threads</h2>
          <span className="text-xs text-muted-foreground">{iterationLabel}</span>
        </header>
        <p className="text-xs leading-5 text-muted-foreground">
          Removed sections and comments whose anchors disappeared move here instead of being forced into the wrong
          inline location.
        </p>

        <div
          className="flex-1 space-y-2 overflow-y-auto pr-1"
          data-testid={iterationChangesSidebarTestIds.docLevelSection}
        >
          {docLevelChanges.map((change) => (
            <IterationChangeCard key={change.id} change={change} />
          ))}
        </div>
      </section>
    </aside>
  );
}

const SIDEBAR_PANEL_CLASS = 'rounded-md border border-border bg-background p-4';
