import type { InboxFilters } from '@contextbridge/shared/inboxSchema';
import { getParentKind } from '../sectionConfig.ts';
import { filterBarTestIds } from '../testIds.ts';

export interface FilterBarProps {
  readonly filters: InboxFilters;
  readonly repositories: string[];
  readonly activeSection: string;
  readonly onFiltersChange: (filters: InboxFilters) => void;
}

export const filterBarCopy = {
  allRepos: 'All repos',
  drafts: 'Drafts',
} as const;

export function FilterBar({ filters, repositories, activeSection, onFiltersChange }: FilterBarProps) {
  // Drafts is a pull-request concept — issues are never drafts — so it only
  // applies on the pull requests page. Dependabot never creates draft PRs so
  // the toggle is hidden on that section too.
  const showPullRequestFilters = getParentKind(activeSection) === 'pull_request' && activeSection !== 'dependabot';
  const showRepoSelect = repositories.length > 1;

  if (!showRepoSelect && !showPullRequestFilters) return null;

  function update(patch: Partial<InboxFilters>): void {
    onFiltersChange({ ...filters, ...patch });
  }

  return (
    <div
      data-testid={filterBarTestIds.container}
      className="flex flex-wrap items-center gap-2 border-b border-border pb-4"
    >
      {showRepoSelect && (
        <select
          data-testid={filterBarTestIds.repoSelect}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
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

      {showRepoSelect && showPullRequestFilters && <Divider />}

      {showPullRequestFilters && (
        <div className="flex items-center gap-1">
          <FilterButton
            label={filterBarCopy.drafts}
            active={filters.includeDrafts ?? false}
            onClick={() => update({ includeDrafts: !filters.includeDrafts })}
            testId={filterBarTestIds.draftsToggle}
          />
        </div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
  testId,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      className={`rounded-md px-2 py-1 text-xs transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-border" />;
}
