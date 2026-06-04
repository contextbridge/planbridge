import type { InboxFilters, InboxTimeWindow } from '@contextbridge/shared/inboxSchema';
import { filterBarTestIds } from '../testIds.ts';

export interface FilterBarProps {
  readonly filters: InboxFilters;
  readonly repositories: string[];
  readonly onFiltersChange: (filters: InboxFilters) => void;
}

export const filterBarCopy = {
  allRepos: 'All repos',
  prsOnly: 'PRs',
  issuesOnly: 'Issues',
  allKinds: 'All',
  allTime: 'All time',
  today: 'Today',
  week: 'Week',
  month: 'Month',
  drafts: 'Drafts',
  dependabot: 'Dependabot',
} as const;

const TIME_WINDOWS: InboxTimeWindow[] = ['today', 'week', 'month', 'all'];
const TIME_LABELS: Record<InboxTimeWindow, string> = {
  today: filterBarCopy.today,
  week: filterBarCopy.week,
  month: filterBarCopy.month,
  all: filterBarCopy.allTime,
};

export function FilterBar({ filters, repositories, onFiltersChange }: FilterBarProps) {
  function update(patch: Partial<InboxFilters>): void {
    onFiltersChange({ ...filters, ...patch });
  }

  return (
    <div
      data-testid={filterBarTestIds.container}
      className="flex flex-wrap items-center gap-3 border-b border-border pb-3"
    >
      {repositories.length > 1 && (
        <select
          data-testid={filterBarTestIds.repoSelect}
          className="rounded border border-border bg-background px-2 py-1 text-sm"
          value={filters.repositories?.[0] ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            update({ repositories: value ? [value] : undefined });
          }}
        >
          <option value="">{filterBarCopy.allRepos}</option>
          {repositories.map((repo) => (
            <option key={repo} value={repo}>
              {repo}
            </option>
          ))}
        </select>
      )}

      <div data-testid={filterBarTestIds.kindToggle} className="flex items-center gap-1">
        <KindButton
          label={filterBarCopy.allKinds}
          active={!filters.kinds || filters.kinds.length === 0}
          onClick={() => update({ kinds: undefined })}
        />
        <KindButton
          label={filterBarCopy.prsOnly}
          active={filters.kinds?.length === 1 && filters.kinds[0] === 'pull_request'}
          onClick={() => update({ kinds: ['pull_request'] })}
        />
        <KindButton
          label={filterBarCopy.issuesOnly}
          active={filters.kinds?.length === 1 && filters.kinds[0] === 'issue'}
          onClick={() => update({ kinds: ['issue'] })}
        />
      </div>

      <div data-testid={filterBarTestIds.timeWindowToggle} className="flex items-center gap-1">
        {TIME_WINDOWS.map((window) => (
          <button
            key={window}
            type="button"
            className={`rounded px-2 py-1 text-xs ${filters.timeWindow === window || (!filters.timeWindow && window === 'all') ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            onClick={() => update({ timeWindow: window === 'all' ? undefined : window })}
          >
            {TIME_LABELS[window]}
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
        <input
          data-testid={filterBarTestIds.draftsToggle}
          type="checkbox"
          checked={filters.includeDrafts ?? false}
          onChange={(event) => update({ includeDrafts: event.target.checked })}
          className="rounded"
        />
        {filterBarCopy.drafts}
      </label>

      <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
        <input
          data-testid={filterBarTestIds.dependabotToggle}
          type="checkbox"
          checked={filters.includeDependabot ?? false}
          onChange={(event) => update({ includeDependabot: event.target.checked })}
          className="rounded"
        />
        {filterBarCopy.dependabot}
      </label>
    </div>
  );
}

function KindButton({
  label,
  active,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded px-2 py-1 text-xs ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
