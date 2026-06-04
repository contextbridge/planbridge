import type { InboxItem } from '@contextbridge/shared/inboxSchema';
import { inboxItemCardTestIds } from '../testIds.ts';

export interface InboxItemCardProps {
  readonly item: InboxItem;
  readonly onOpen: (url: string) => void;
}

export const inboxItemCardCopy = {
  openInGitHub: 'Open in GitHub',
  draft: 'Draft',
} as const;

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const REASON_LABELS: Record<string, string> = {
  review_requested: 'Review Requested',
  assigned_to_me: 'Assigned to Me',
  mentioned_me: 'Mentioned',
  authored_by_me_needs_attention: 'Authored',
  recent_activity: 'Recent Activity',
  ci_failing: 'CI Failing',
  dependabot: 'Dependabot',
};

export function InboxItemCard({ item, onOpen }: InboxItemCardProps) {
  return (
    <div data-testid={inboxItemCardTestIds.container} className="flex items-start gap-3 border-b border-border py-3">
      <span data-testid={inboxItemCardTestIds.kindIcon} className="mt-0.5 shrink-0 text-sm">
        {item.kind === 'pull_request' ? '🔀' : ' issue '}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {item.owner}/{item.repository}#{item.number}
          </span>
          {item.isDraft && (
            <span className="rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {inboxItemCardCopy.draft}
            </span>
          )}
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 block truncate text-sm font-medium leading-snug hover:underline"
          onClick={(event) => {
            event.preventDefault();
            onOpen(item.url);
          }}
        >
          {item.title}
        </a>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            data-testid={inboxItemCardTestIds.priorityBadge}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${PRIORITY_COLORS[item.priority] ?? ''}`}
          >
            {item.priority}
          </span>
          {item.reasons.map((reason) => (
            <span
              key={reason}
              data-testid={inboxItemCardTestIds.reasonBadge}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {REASON_LABELS[reason] ?? reason}
            </span>
          ))}
          {item.labels?.map((label) => (
            <span
              key={label.name}
              className="rounded border border-border px-1.5 py-0.5 text-[10px]"
              style={label.color ? { borderColor: `#${label.color}` } : undefined}
            >
              {label.name}
            </span>
          ))}
        </div>
      </div>

      <button
        data-testid={inboxItemCardTestIds.openButton}
        type="button"
        className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        onClick={() => onOpen(item.url)}
      >
        {inboxItemCardCopy.openInGitHub}
      </button>
    </div>
  );
}
