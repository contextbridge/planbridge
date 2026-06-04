import type { InboxItem } from '@contextbridge/shared/inboxSchema';
import { prioritySectionTestIds } from '../testIds.ts';
import { InboxItemRow } from './InboxItemRow.tsx';

export interface PrioritySectionProps {
  readonly heading: string;
  readonly items: InboxItem[];
  readonly onOpen: (url: string) => void;
}

export function PrioritySection({ heading, items, onOpen }: PrioritySectionProps) {
  return (
    <section data-testid={prioritySectionTestIds.container}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2
          data-testid={prioritySectionTestIds.heading}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {heading}
        </h2>
        <span data-testid={prioritySectionTestIds.count} className="text-xs tabular-nums text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="border-t border-border">
        {items.map((item) => (
          <InboxItemRow key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
