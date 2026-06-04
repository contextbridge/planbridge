import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxApiClient } from './apiClient.ts';
import { App, LoadedInbox, type LoadedInboxProps, errorStateCopy } from './App.tsx';
import { emptyStateCopy } from './components/EmptyState.tsx';
import { inboxItem, inboxSnapshot } from './testFactories.ts';
import { appTestIds, inboxItemCardTestIds, prioritySectionTestIds } from './testIds.ts';

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
          priority: 'urgent',
          title: 'Fix production crash',
          reasons: ['review_requested'],
        }),
      ],
    });
    const client = fakeApiClient({ fetchSnapshot: () => Promise.resolve(snapshot) });
    render(<App apiClient={client} />);

    expect(await screen.findByText('Fix production crash')).toBeInTheDocument();
    expect(screen.getByTestId(appTestIds.viewerLogin)).toHaveTextContent('testuser');
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
      priority: 'urgent',
      priorityScore: 180,
      reasons: ['review_requested', 'ci_failing'],
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
      priority: 'high',
      priorityScore: 100,
      reasons: ['review_requested'],
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
      priority: 'low',
      priorityScore: -30,
      reasons: ['dependabot'],
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

  it('renders items grouped by priority', () => {
    render(<LoadedInbox {...defaultProps} />);
    const sections = screen.getAllByTestId(prioritySectionTestIds.heading);
    expect(sections.map((el) => el.textContent)).toEqual(['Urgent', 'Needs Review', 'Lower Priority']);
  });

  it('shows item details', () => {
    render(<LoadedInbox {...defaultProps} />);
    expect(screen.getByText('Fix production crash in auth handler')).toBeInTheDocument();
    expect(screen.getByText('myorg/myrepo#42')).toBeInTheDocument();
  });

  it('calls onOpen when Open in GitHub is clicked', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<LoadedInbox {...defaultProps} onOpen={onOpen} />);

    const openButtons = screen.getAllByTestId(inboxItemCardTestIds.openButton);
    const firstButton = openButtons[0];
    if (!firstButton) throw new Error('Expected at least one open button');
    await user.click(firstButton);
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
