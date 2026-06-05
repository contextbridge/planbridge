import type {
  InboxActionState,
  InboxFilters,
  InboxItem,
  InboxItemKind,
  InboxSnapshot,
} from '@contextbridge/shared/inboxSchema';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import type { InboxApiClient } from './apiClient.ts';
import { EmptyState } from './components/EmptyState.tsx';
import { ErrorState, errorStateCopy } from './components/ErrorState.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { Header } from './components/Header.tsx';
import { InboxItemRow } from './components/InboxItemRow.tsx';
import { LoadingState } from './components/LoadingState.tsx';
import { SidebarNav } from './components/SidebarNav.tsx';
import { applyInboxFilters, extractRepositories } from './inboxGrouping.ts';
import { countBySection, filterItemsBySection, getSection } from './sectionConfig.ts';
import { appTestIds } from './testIds.ts';
import { useInboxSnapshot } from './useInboxSnapshot.ts';

const DEFAULT_SECTION = 'needs_my_review';

// The server returns drafts and Dependabot items so the client can toggle/section
// them locally; the snapshot is fetched once with this and never re-fetched for a
// filter or section change.
const FULL_FETCH_FILTERS: InboxFilters = { includeDrafts: true, includeDependabot: true };

const SORTABLE_COLUMNS = [
  { key: 'kind', label: 'Type', className: 'w-24' },
  { key: 'title', label: 'Title', className: 'w-full' },
  { key: 'repository', label: 'Repository', className: 'w-44' },
  { key: 'number', label: '#', className: 'w-20' },
  { key: 'status', label: 'Status', className: 'w-40' },
  { key: 'labels', label: 'Labels', className: 'w-44' },
] as const satisfies readonly SortableColumn[];

const ACTION_STATE_SORT_ORDER: Record<InboxActionState, number> = {
  needs_my_review: 0,
  changes_requested: 1,
  ci_failing: 2,
  conflicts: 3,
  ready_to_merge: 4,
  waiting_on_others: 5,
  assigned_issue: 6,
};

const KIND_SORT_ORDER: Record<InboxItemKind, number> = {
  pull_request: 0,
  issue: 1,
};

type SortKey = 'kind' | 'title' | 'repository' | 'number' | 'status' | 'labels';
type SortDirection = 'ascending' | 'descending';

interface SortState {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

interface SortableColumn {
  readonly key: SortKey;
  readonly label: string;
  readonly className: string;
}

export interface AppProps {
  readonly apiClient: InboxApiClient;
}

export function App({ apiClient }: AppProps) {
  const [activeSection, setActiveSection] = useState(DEFAULT_SECTION);
  // Client-side UI filters only (drafts toggle, repository select). Section/kind
  // selection lives in `activeSection`; neither triggers a server round trip.
  const [filters, setFilters] = useState<InboxFilters>({});
  const { snapshot, status, error, refresh } = useInboxSnapshot(apiClient, FULL_FETCH_FILTERS);

  function handleSectionChange(sectionKey: string): void {
    setActiveSection(sectionKey);
  }

  function handleFiltersChange(nextFilters: InboxFilters): void {
    setFilters(nextFilters);
  }

  function handleOpen(url: string): void {
    void apiClient.openItem(url).catch(() => {
      // Open failures are non-critical — the user can click the link directly.
    });
  }

  function handleRefresh(): void {
    void refresh();
  }

  function handleRetry(): void {
    void refresh();
  }

  const sectionConfig = getSection(activeSection);
  const visibleItems = snapshot ? applyInboxFilters(snapshot.items, filters) : [];
  const filteredItems = filterItemsBySection(visibleItems, activeSection);

  return (
    <div data-testid={appTestIds.container} className="flex min-h-screen">
      <SidebarNav
        activeSection={activeSection}
        sectionCounts={countBySection(visibleItems)}
        onSectionChange={handleSectionChange}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-neutral-950">
        <Header title={sectionConfig.heading} viewer={snapshot?.viewer ?? null} onRefresh={handleRefresh} />
        <div className="w-full max-w-7xl px-6 py-4">
          {status === 'loading' && <LoadingState />}
          {status === 'error' && error && <ErrorState error={error} onRetry={handleRetry} />}
          {status === 'loaded' && snapshot && (
            <LoadedInbox
              items={filteredItems}
              snapshot={snapshot}
              filters={filters}
              activeSection={activeSection}
              onFiltersChange={handleFiltersChange}
              onOpen={handleOpen}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export interface LoadedInboxProps {
  readonly items: readonly InboxItem[];
  readonly snapshot: InboxSnapshot;
  readonly filters: InboxFilters;
  readonly activeSection: string;
  readonly onFiltersChange: (filters: InboxFilters) => void;
  readonly onOpen: (url: string) => void;
}

export function LoadedInbox({ items, snapshot, filters, activeSection, onFiltersChange, onOpen }: LoadedInboxProps) {
  const repositories = extractRepositories(snapshot.items);
  const [sort, setSort] = useState<SortState>({ key: 'status', direction: 'ascending' });
  const sortedItems = sortItems(items, sort);

  function handleSort(nextKey: SortKey): void {
    setSort((current) => {
      if (current.key !== nextKey) return { key: nextKey, direction: 'ascending' };
      return { key: nextKey, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
    });
  }

  return (
    <>
      {snapshot.warnings && snapshot.warnings.length > 0 && (
        <div
          data-testid={appTestIds.warningBanner}
          className="mb-4 border-l-2 border-amber-500 py-1 pl-3 text-sm text-amber-700 dark:text-amber-300"
        >
          {snapshot.warnings.join(' ')}
        </div>
      )}
      <FilterBar
        filters={filters}
        repositories={repositories}
        activeSection={activeSection}
        onFiltersChange={onFiltersChange}
      />
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {SORTABLE_COLUMNS.map((column) => (
                  <SortableHeaderCell key={column.key} column={column} sort={sort} onSort={handleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <InboxItemRow key={item.id} item={item} onOpen={onOpen} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface SortableHeaderCellProps {
  readonly column: SortableColumn;
  readonly sort: SortState;
  readonly onSort: (key: SortKey) => void;
}

function SortableHeaderCell({ column, sort, onSort }: SortableHeaderCellProps) {
  const isActive = sort.key === column.key;
  const Icon = isActive ? (sort.direction === 'ascending' ? ArrowUp : ArrowDown) : ArrowUpDown;
  const ariaSort = isActive ? sort.direction : 'none';
  const buttonClass = isActive
    ? 'border-foreground/15 bg-background text-foreground shadow-sm dark:bg-neutral-900'
    : 'border-transparent hover:border-border hover:bg-background/80 hover:text-foreground dark:hover:bg-neutral-900/80';

  function handleClick(): void {
    onSort(column.key);
  }

  return (
    <th className={`${column.className} px-3 py-2 text-left`} aria-sort={ariaSort} scope="col">
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition-all ${buttonClass}`}
        onClick={handleClick}
      >
        <span>{column.label}</span>
        <span
          aria-hidden
          className={`grid size-4 place-items-center rounded-full ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground/70'}`}
        >
          <Icon className="size-3" />
        </span>
      </button>
    </th>
  );
}

export { errorStateCopy };

function sortItems(items: readonly InboxItem[], sort: SortState): InboxItem[] {
  return [...items].sort((first, second) => {
    const comparison = compareItems(first, second, sort.key);
    const directedComparison = sort.direction === 'ascending' ? comparison : -comparison;
    return directedComparison || first.id.localeCompare(second.id);
  });
}

function compareItems(first: InboxItem, second: InboxItem, key: SortKey): number {
  switch (key) {
    case 'kind':
      return KIND_SORT_ORDER[first.kind] - KIND_SORT_ORDER[second.kind] || compareText(first.kind, second.kind);
    case 'title':
      return compareText(first.title, second.title);
    case 'repository':
      return compareText(repositoryLabel(first), repositoryLabel(second));
    case 'number':
      return first.number - second.number;
    case 'status':
      return ACTION_STATE_SORT_ORDER[first.actionState] - ACTION_STATE_SORT_ORDER[second.actionState];
    case 'labels':
      return compareText(labelsLabel(first), labelsLabel(second));
  }
}

function compareText(first: string, second: string): number {
  return first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' });
}

function repositoryLabel(item: InboxItem): string {
  return `${item.owner}/${item.repository}`;
}

function labelsLabel(item: InboxItem): string {
  const labels = item.labels?.map((label) => label.name) ?? [];
  return [item.isDraft ? 'Draft' : '', ...labels].filter(Boolean).join(', ');
}
