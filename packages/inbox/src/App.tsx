import type { InboxFilters, InboxSnapshot } from '@contextbridge/shared/inboxSchema';
import { useState } from 'react';
import type { InboxApiClient } from './apiClient.ts';
import { EmptyState } from './components/EmptyState.tsx';
import { ErrorState, errorStateCopy } from './components/ErrorState.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { Header } from './components/Header.tsx';
import { LoadingState } from './components/LoadingState.tsx';
import { PrioritySection } from './components/PrioritySection.tsx';
import { extractRepositories, groupByPriority } from './inboxGrouping.ts';
import { appTestIds } from './testIds.ts';
import { useInboxSnapshot } from './useInboxSnapshot.ts';

export interface AppProps {
  readonly apiClient: InboxApiClient;
}

export function App({ apiClient }: AppProps) {
  const [filters, setFilters] = useState<InboxFilters>({});
  const { snapshot, status, error, refresh } = useInboxSnapshot(apiClient, filters);

  function handleFiltersChange(nextFilters: InboxFilters): void {
    setFilters(nextFilters);
    void refresh(nextFilters);
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

  return (
    <div data-testid={appTestIds.container} className="min-h-screen bg-background">
      <Header viewer={snapshot?.viewer ?? null} onRefresh={handleRefresh} />
      <div className="mx-auto max-w-4xl px-6 py-4">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && error && <ErrorState error={error} onRetry={handleRetry} />}
        {status === 'loaded' && snapshot && (
          <LoadedInbox
            snapshot={snapshot}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onOpen={handleOpen}
          />
        )}
      </div>
    </div>
  );
}

export interface LoadedInboxProps {
  readonly snapshot: InboxSnapshot;
  readonly filters: InboxFilters;
  readonly onFiltersChange: (filters: InboxFilters) => void;
  readonly onOpen: (url: string) => void;
}

export function LoadedInbox({ snapshot, filters, onFiltersChange, onOpen }: LoadedInboxProps) {
  const repositories = extractRepositories(snapshot.items);
  const groups = groupByPriority(snapshot.items);

  return (
    <>
      {snapshot.warnings && snapshot.warnings.length > 0 && (
        <div
          data-testid={appTestIds.warningBanner}
          className="mb-4 border-l-4 border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          {snapshot.warnings.join(' ')}
        </div>
      )}
      <FilterBar filters={filters} repositories={repositories} onFiltersChange={onFiltersChange} />
      <div className="mt-4 space-y-6">
        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          groups.map((group) => (
            <PrioritySection key={group.priority} heading={group.heading} items={group.items} onOpen={onOpen} />
          ))
        )}
      </div>
    </>
  );
}

export { errorStateCopy };
