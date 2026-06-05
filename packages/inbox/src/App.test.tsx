import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxApiClient } from './apiClient.ts';
import { App, LoadedInbox, type LoadedInboxProps, errorStateCopy } from './App.tsx';
import { emptyStateCopy } from './components/EmptyState.tsx';
import { inboxItem, inboxSnapshot } from './testFactories.ts';
import { appTestIds, filterBarTestIds, inboxItemCardTestIds, sidebarNavTestIds } from './testIds.ts';

afterEach(cleanup);

function fakeApiClient(overrides: Partial<InboxApiClient> = {}): InboxApiClient {
  return {
    fetchSnapshot: () => Promise.resolve(inboxSnapshot.build()),
    openItem: () => Promise.resolve(),
    ...overrides,
  };
}

describe('App', () => {
  it('renders loading state initially', () => {
    const client = fakeApiClient({
      fetchSnapshot: () => new Promise(() => {}),
    });
    render(<App apiClient={client} />);
    expect(screen.getByText('Loading inbox…')).toBeInTheDocument();
  });

  it('renders loaded inbox with items', async () => {
    const snapshot = inboxSnapshot.build({
      viewer: 'testuser',
      items: [
        inboxItem.build({
          id: 'app-item-1',
          nodeId: 'app-node-1',
          actionState: 'needs_my_review',
          title: 'Fix production crash',
        }),
      ],
    });
    const client = fakeApiClient({ fetchSnapshot: () => Promise.resolve(snapshot) });
    render(<App apiClient={client} />);

    expect(await screen.findByText('Fix production crash')).toBeInTheDocument();
    expect(screen.getByTestId(appTestIds.viewerLogin)).toHaveTextContent('testuser');
  });

  it('defaults to Needs My Review and fetches the full snapshot once on mount', async () => {
    const fetchSnapshot = vi.fn(() => Promise.resolve(inboxSnapshot.build()));
    const client = fakeApiClient({ fetchSnapshot });
    render(<App apiClient={client} />);

    await screen.findByTestId(sidebarNavTestIds.container);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    // Drafts/Dependabot are fetched so the client can toggle/section them locally.
    expect(fetchSnapshot).toHaveBeenCalledWith(expect.objectContaining({ includeDrafts: true }));

    const needsReviewButton = screen.getByTestId(sidebarNavTestIds.sectionButton('needs_my_review'));
    expect(needsReviewButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches sections client-side without re-fetching', async () => {
    const snapshot = inboxSnapshot.build({
      items: [
        inboxItem.build({
          id: 'pr-1',
          nodeId: 'pr-1',
          actionState: 'needs_my_review',
          kind: 'pull_request',
          title: 'Review me please',
        }),
        inboxItem.build({
          id: 'issue-1',
          nodeId: 'issue-1',
          number: 2,
          actionState: 'assigned_issue',
          kind: 'issue',
          title: 'An assigned issue',
          url: 'https://github.com/owner/repo/issues/2',
        }),
      ],
    });
    const fetchSnapshot = vi.fn(() => Promise.resolve(snapshot));
    const client = fakeApiClient({ fetchSnapshot });
    const user = userEvent.setup();
    render(<App apiClient={client} />);

    expect(await screen.findByText('Review me please')).toBeInTheDocument();
    expect(screen.queryByText('An assigned issue')).not.toBeInTheDocument();

    await user.click(screen.getByTestId(sidebarNavTestIds.sectionButton('assigned_issues')));
    expect(screen.getByText('An assigned issue')).toBeInTheDocument();
    expect(screen.queryByText('Review me please')).not.toBeInTheDocument();

    // The section change is pure client-side filtering — no extra GitHub round trip.
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('hides the pull-request-only filters when an issues section is active', async () => {
    const client = fakeApiClient();
    const user = userEvent.setup();
    render(<App apiClient={client} />);

    expect(await screen.findByTestId(filterBarTestIds.draftsToggle)).toBeInTheDocument();

    await user.click(screen.getByTestId(sidebarNavTestIds.sectionButton('assigned_issues')));
    expect(screen.queryByTestId(filterBarTestIds.draftsToggle)).not.toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    const client = fakeApiClient({
      fetchSnapshot: () => Promise.reject(new Error('Network error')),
    });
    render(<App apiClient={client} />);

    expect(await screen.findByText(errorStateCopy.title)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders empty state when no items match the active section', async () => {
    const snapshot = inboxSnapshot.build({ items: [] });
    const client = fakeApiClient({ fetchSnapshot: () => Promise.resolve(snapshot) });
    render(<App apiClient={client} />);

    expect(await screen.findByText(emptyStateCopy.title)).toBeInTheDocument();
  });
});

describe('LoadedInbox', () => {
  const testItems = [
    inboxItem.build({
      id: 'item-urgent',
      nodeId: 'node-urgent',
      actionState: 'needs_my_review',
      title: 'Fix production crash in auth handler',
      kind: 'pull_request',
      owner: 'myorg',
      repository: 'myrepo',
      number: 42,
      url: 'https://github.com/myorg/myrepo/pull/42',
    }),
    inboxItem.build({
      id: 'item-high',
      nodeId: 'node-high',
      actionState: 'changes_requested',
      title: 'Refactor database connection pool',
      kind: 'pull_request',
      owner: 'myorg',
      repository: 'other-repo',
      number: 7,
      url: 'https://github.com/myorg/other-repo/pull/7',
    }),
    inboxItem.build({
      id: 'item-low',
      nodeId: 'node-low',
      actionState: 'waiting_on_others',
      title: 'Bump eslint from 9.0.0 to 9.1.0',
      kind: 'pull_request',
      url: 'https://github.com/owner/repo/pull/99',
    }),
  ];

  const defaultProps: LoadedInboxProps = {
    items: testItems,
    snapshot: inboxSnapshot.build({
      viewer: 'testuser',
      items: testItems,
    }),
    filters: {},
    activeSection: 'needs_my_review',
    onFiltersChange: () => {},
    onOpen: () => {},
  };

  it('renders items passed via props', () => {
    render(<LoadedInbox {...defaultProps} />);
    expect(screen.getByText('Fix production crash in auth handler')).toBeInTheDocument();
    expect(screen.getByText('Refactor database connection pool')).toBeInTheDocument();
    expect(screen.getByText('Bump eslint from 9.0.0 to 9.1.0')).toBeInTheDocument();
  });

  it('shows item details in table columns', () => {
    render(<LoadedInbox {...defaultProps} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
    const repoMatches = screen.getAllByText('myorg/myrepo');
    expect(repoMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onOpen when an item row is clicked', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<LoadedInbox {...defaultProps} onOpen={onOpen} />);

    const rows = screen.getAllByTestId(inboxItemCardTestIds.container);
    const firstRow = rows[0];
    if (!firstRow) throw new Error('Expected at least one item row');
    await user.click(firstRow);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(expect.stringContaining('github.com'));
  });

  it('renders warning banner when warnings are present', () => {
    const props: LoadedInboxProps = {
      ...defaultProps,
      snapshot: inboxSnapshot.build({
        items: testItems,
        warnings: ['Partial query failure for assigned issues.'],
      }),
    };
    render(<LoadedInbox {...props} />);
    expect(screen.getByTestId(appTestIds.warningBanner)).toHaveTextContent('Partial query failure');
  });

  it('renders without warning banner when no warnings', () => {
    render(<LoadedInbox {...defaultProps} />);
    expect(screen.queryByTestId(appTestIds.warningBanner)).not.toBeInTheDocument();
  });

  it('sorts table columns when headers are clicked', async () => {
    const user = userEvent.setup();
    render(<LoadedInbox {...defaultProps} />);

    const titleHeader = screen.getByRole('columnheader', { name: /title/i });
    const titleSortButton = screen.getByRole('button', { name: /title/i });

    await user.click(titleSortButton);
    expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(rowTexts()).toEqual([
      expect.stringContaining('Bump eslint from 9.0.0 to 9.1.0'),
      expect.stringContaining('Fix production crash in auth handler'),
      expect.stringContaining('Refactor database connection pool'),
    ]);

    await user.click(titleSortButton);
    expect(titleHeader).toHaveAttribute('aria-sort', 'descending');
    expect(rowTexts()).toEqual([
      expect.stringContaining('Refactor database connection pool'),
      expect.stringContaining('Fix production crash in auth handler'),
      expect.stringContaining('Bump eslint from 9.0.0 to 9.1.0'),
    ]);
  });

  it('keeps long titles constrained while preserving the full title as a tooltip', () => {
    const longTitle =
      'Investigate a very long pull request title that should truncate inside the table instead of widening it';
    const props: LoadedInboxProps = {
      ...defaultProps,
      items: [inboxItem.build({ id: 'item-long-title', nodeId: 'node-long-title', title: longTitle })],
    };
    render(<LoadedInbox {...props} />);

    expect(screen.getByText(longTitle)).toHaveAttribute('title', longTitle);
  });

  it('shows empty state when items array is empty', () => {
    const props: LoadedInboxProps = {
      ...defaultProps,
      items: [],
    };
    render(<LoadedInbox {...props} />);
    expect(screen.getByText(emptyStateCopy.title)).toBeInTheDocument();
  });
});

function rowTexts(): string[] {
  return screen.getAllByTestId(inboxItemCardTestIds.container).map((row) => row.textContent ?? '');
}
