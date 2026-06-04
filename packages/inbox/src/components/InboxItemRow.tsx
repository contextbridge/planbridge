import type { InboxActionState, InboxItem } from '@contextbridge/shared/inboxSchema';
import { CircleDot, GitPullRequest } from 'lucide-react';
import { inboxItemCardTestIds } from '../testIds.ts';

export interface InboxItemRowProps {
  readonly item: InboxItem;
  readonly onOpen: (url: string) => void;
}

export const inboxItemCardCopy = {
  draft: 'Draft',
} as const;

export const actionStateLabels: Record<InboxActionState, string> = {
  needs_my_review: 'Needs Review',
  changes_requested: 'Changes Requested',
  ci_failing: 'CI Failing',
  conflicts: 'Conflicts',
  ready_to_merge: 'Ready to Merge',
  waiting_on_others: 'Waiting',
  assigned_issue: 'Assigned',
};

// The dot carries the state; the label stays muted so it never competes with the title.
const ACTION_STATE_DOT_COLORS: Record<InboxActionState, string> = {
  needs_my_review: 'bg-amber-500',
  changes_requested: 'bg-red-500',
  ci_failing: 'bg-red-500',
  conflicts: 'bg-amber-500',
  ready_to_merge: 'bg-green-500',
  waiting_on_others: 'bg-neutral-400',
  assigned_issue: 'bg-blue-500',
};

const KIND_COLORS: Record<string, string> = {
  pull_request: 'text-green-600 dark:text-green-400',
  issue: 'text-blue-600 dark:text-blue-400',
};

// Quiet outline chip — shared by reasons, labels, and the draft marker so no
// single piece of metadata looks louder than the rest.
const CHIP_CLASS = 'rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground';

export function InboxItemRow({ item, onOpen }: InboxItemRowProps) {
  const Icon = item.kind === 'pull_request' ? GitPullRequest : CircleDot;
  const iconColor = KIND_COLORS[item.kind] ?? '';

  return (
    <div
      data-testid={inboxItemCardTestIds.container}
      className="group flex items-start gap-3 border-b border-border px-2 py-2 transition-colors hover:bg-muted/40"
    >
      <span
        data-testid={inboxItemCardTestIds.kindIcon}
        className={`flex h-6 w-4 shrink-0 items-center justify-center ${iconColor}`}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <a
          data-testid={inboxItemCardTestIds.titleLink}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-medium leading-6 hover:underline"
          onClick={(event) => {
            event.preventDefault();
            onOpen(item.url);
          }}
        >
          {item.title}
        </a>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs text-muted-foreground">
            {item.owner}/{item.repository}#{item.number}
          </span>

          <span
            data-testid={inboxItemCardTestIds.stateBadge}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span aria-hidden className={`size-1.5 rounded-full ${ACTION_STATE_DOT_COLORS[item.actionState]}`} />
            {actionStateLabels[item.actionState]}
          </span>

          {item.isDraft && <span className={`${CHIP_CLASS} uppercase tracking-wide`}>{inboxItemCardCopy.draft}</span>}

          {item.labels?.map((label) => (
            <span
              key={label.name}
              className={CHIP_CLASS}
              style={label.color ? { borderColor: `#${label.color}` } : undefined}
            >
              {label.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
