import type { InboxItemKind } from '@contextbridge/shared/inboxSchema';
import { pageTabsTestIds } from '../testIds.ts';

export interface PageTabsProps {
  readonly activeKind: InboxItemKind;
  readonly onKindChange: (kind: InboxItemKind) => void;
}

export const pageTabsCopy = {
  pullRequests: 'Pull Requests',
  issues: 'Issues',
} as const;

export function PageTabs({ activeKind, onKindChange }: PageTabsProps) {
  return (
    <nav
      role="tablist"
      data-testid={pageTabsTestIds.container}
      className="flex items-center gap-6 border-b border-border"
    >
      <Tab
        label={pageTabsCopy.pullRequests}
        active={activeKind === 'pull_request'}
        onClick={() => onKindChange('pull_request')}
        testId={pageTabsTestIds.pullRequestsTab}
      />
      <Tab
        label={pageTabsCopy.issues}
        active={activeKind === 'issue'}
        onClick={() => onKindChange('issue')}
        testId={pageTabsTestIds.issuesTab}
      />
    </nav>
  );
}

function Tab({
  label,
  active,
  onClick,
  testId,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      className={`-mb-px border-b-2 px-1 py-2 text-sm font-medium transition-colors ${active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
