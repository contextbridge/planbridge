import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxApiClient } from './apiClient.ts';
import { App, LoadedInbox, type LoadedInboxProps, errorStateCopy } from './App.tsx';
import { emptyStateCopy } from './components/EmptyState.tsx';
import { inboxItem, inboxSnapshot } from './testFactories.ts';
import {
  appTestIds,
  filterBarTestIds,
  inboxItemCardTestIds,
  pageTabsTestIds,
  prioritySectionTestIds,
} from './testIds.ts';

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

  it('opens the pull requests page by default and refetches issues on tab switch', async () => {
    const fetchSnapshot = vi.fn(() => Promise.resolve(inboxSnapshot.build()));
    const client = fakeApiClient({ fetchSnapshot });
    const user = userEvent.setup();
    render(<App apiClient={client} />);

    await screen.findByTestId(pageTabsTestIds.container);
    expect(fetchSnapshot).toHaveBeenCalledWith(expect.objectContaining({ kinds: ['pull_request'] }));

    await user.click(screen.getByTestId(pageTabsTestIds.issuesTab));
    expect(fetchSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ kinds: ['issue'] }));
  });

  it('hides the pull-request-only filters on the issues page', async () => {
    const client = fakeApiClient();
    const user = userEvent.setup();
    render(<App apiClient={client} />);

    expect(await screen.findByTestId(filterBarTestIds.draftsToggle)).toBeInTheDocument();

    await user.click(screen.getByTestId(pageTabsTestIds.issuesTab));
    expect(screen.queryByTestId(filterBarTestIds.draftsToggle)).not.toBeInTheDocument();
    expect(screen.queryByTestId(filterBarTestIds.dependabotToggle)).not.toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    const client = fakeApiClient({
      fetchSnapshot: () => Promise.reject(new Error('Network error')),
    });
    render(<App apiClient={client} />);

    expect(await screen.findByText(errorStateCopy.title)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders empty state when no items', async () => {
    const snapshot = inboxSnapshot.build({ items: [] });
    const client = fakeApiClient({ fetchSnapshot: () => Promise.resolve(snapshot) });
    render(<App apiClient={client} />);

    expect(await screen.findByText(emptyStateCopy.title)).toBeInTheDocument();
  });
});

function testItems() {
  return [
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
}

describe('LoadedInbox', () => {
  const defaultProps: LoadedInboxProps = {
    snapshot: inboxSnapshot.build({
      viewer: 'testuser',
      items: testItems(),
    }),
    filters: {},
    onFiltersChange: () => {},
    onOpen: () => {},
  };

  it('renders items grouped by action state', () => {
    render(<LoadedInbox {...defaultProps} />);
    const sections = screen.getAllByTestId(prioritySectionTestIds.heading);
    expect(sections.map((el) => el.textContent)).toEqual([
      'Needs My Review',
      'My PRs — Action Needed',
      'Waiting on Others',
    ]);
  });

  it('shows item details', () => {
    render(<LoadedInbox {...defaultProps} />);
    expect(screen.getByText('Fix production crash in auth handler')).toBeInTheDocument();
    expect(screen.getByText('myorg/myrepo#42')).toBeInTheDocument();
  });

  it('calls onOpen when an item title is clicked', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<LoadedInbox {...defaultProps} onOpen={onOpen} />);

    const titleLinks = screen.getAllByTestId(inboxItemCardTestIds.titleLink);
    const firstLink = titleLinks[0];
    if (!firstLink) throw new Error('Expected at least one item title link');
    await user.click(firstLink);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(expect.stringContaining('github.com'));
  });

  it('renders warning banner when warnings are present', () => {
    const props: LoadedInboxProps = {
      ...defaultProps,
      snapshot: inboxSnapshot.build({
        items: testItems(),
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
});
