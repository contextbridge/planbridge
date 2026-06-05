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

const CHIP_CLASS = 'rounded-full px-1.5 py-0.5 text-xs text-muted-foreground';

export function InboxItemRow({ item, onOpen }: InboxItemRowProps) {
  const Icon = item.kind === 'pull_request' ? GitPullRequest : CircleDot;
  const iconColor = KIND_COLORS[item.kind] ?? '';

  function handleRowClick() {
    onOpen(item.url);
  }

  return (
    <tr
      data-testid={inboxItemCardTestIds.container}
      className="group cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/40"
      onClick={handleRowClick}
    >
      <td className="w-10 px-3 py-2 align-middle">
        <span
          data-testid={inboxItemCardTestIds.kindIcon}
          className={`flex h-6 w-4 items-center justify-center ${iconColor}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </td>

      <td className="max-w-0 px-3 py-2 align-middle">
        <span
          className="block truncate text-sm font-medium leading-6 underline-offset-2 group-hover:underline"
          title={item.title}
        >
          {item.title}
        </span>
      </td>

      <td className="whitespace-nowrap px-3 py-2 align-middle">
        <span className="font-mono text-xs text-muted-foreground">
          {item.owner}/{item.repository}
        </span>
      </td>

      <td className="whitespace-nowrap px-3 py-2 align-middle">
        <span className="font-mono text-xs text-muted-foreground">#{item.number}</span>
      </td>

      <td className="whitespace-nowrap px-3 py-2 align-middle">
        <span
          data-testid={inboxItemCardTestIds.stateBadge}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span aria-hidden className={`size-1.5 rounded-full ${ACTION_STATE_DOT_COLORS[item.actionState]}`} />
          {actionStateLabels[item.actionState]}
        </span>
      </td>

      <td className="px-3 py-2 align-middle">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.isDraft && <span className={`${CHIP_CLASS} uppercase tracking-wide`}>{inboxItemCardCopy.draft}</span>}
          {item.labels?.map((label) => (
            <span
              key={label.name}
              className={CHIP_CLASS}
              style={label.color ? { backgroundColor: `#${label.color}1A` } : undefined}
            >
              {label.name}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}
