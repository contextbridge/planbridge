import type { InboxActionState, InboxFilters, InboxItem } from '@contextbridge/shared/inboxSchema';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { InboxApiClient } from './apiClient.ts';
import { App } from './App.tsx';
import { SECTIONS } from './sectionConfig.ts';
import { inboxItem, inboxSnapshot } from './testFactories.ts';

const meta: Meta<typeof App> = {
  title: 'Inbox/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const BUG = { name: 'bug', color: 'd73a4a' };
const FEATURE = { name: 'feature', color: '0e8a16' };
const DOCS = { name: 'docs', color: '0075ca' };

// A full inbox: items spanning all action states across two repos so the repo
// picker shows up. The sidebar section buttons let you drill into each lane.
const ALL_ITEMS: InboxItem[] = [
  pr(101, 'needs_my_review', 'Fix critical parsing bug in the lexer', 'aether', { labels: [BUG] }),
  pr(102, 'needs_my_review', 'Add OAuth device-flow login', 'planbridge', { labels: [FEATURE] }),
  pr(103, 'changes_requested', 'Refactor the database connection pool', 'aether'),
  pr(104, 'ci_failing', 'Migrate the local server to Bun.serve', 'planbridge'),
  pr(105, 'conflicts', 'Rename Plannotator to PlanBridge across the CLI', 'aether'),
  pr(106, 'ready_to_merge', 'Add a retry budget to the fetch client', 'planbridge'),
  pr(107, 'waiting_on_others', 'Tune the inbox action-state thresholds', 'aether'),
  pr(108, 'waiting_on_others', 'WIP: streaming annotations over SSE', 'planbridge', { isDraft: true, state: 'draft' }),
  pr(109, 'waiting_on_others', 'Bump eslint from 9.0.0 to 9.1.0', 'planbridge', {
    author: { login: 'dependabot[bot]' },
    labels: [{ name: 'dependencies', color: '0366d6' }],
  }),
  issue(201, 'Inbox only shows issues from the current repo', 'aether', { labels: [BUG] }),
  issue(202, 'Document the action-state model in AGENTS.md', 'planbridge', { labels: [DOCS] }),
];

export const Default: Story = {
  render: () => <App apiClient={filteringApiClient([inboxItem.build()])} />,
};

export const Empty: Story = {
  render: () => <App apiClient={filteringApiClient([])} />,
};

// Click sidebar section buttons and toggle Drafts to walk through every lane
// and badge.
export const Populated: Story = {
  render: () => <App apiClient={filteringApiClient(ALL_ITEMS)} />,
};

export const WithWarnings: Story = {
  render: () => (
    <App
      apiClient={filteringApiClient(ALL_ITEMS, ['Partial results: the GitHub search for assigned issues timed out.'])}
    />
  ),
};

function filteringApiClient(items: InboxItem[], warnings?: string[]): InboxApiClient {
  return {
    async fetchSnapshot(filters: InboxFilters) {
      return inboxSnapshot.build({
        viewer: 'octocat',
        items: items.filter((item) => matches(item, filters)),
        warnings,
      });
    },
    async openItem() {},
  };
}

function matches(item: InboxItem, filters: InboxFilters): boolean {
  const { kinds, includeDrafts = false, repositories } = filters;
  if (kinds && !kinds.includes(item.kind)) return false;
  if (!includeDrafts && item.isDraft) return false;
  if (repositories?.length && !repositories.includes(`${item.owner}/${item.repository}`)) return false;
  return true;
}

function pr(
  number: number,
  actionState: InboxActionState,
  title: string,
  repository: string,
  extra: Partial<InboxItem> = {},
): InboxItem {
  return inboxItem.build({
    id: `pr-${number}`,
    nodeId: `pr-node-${number}`,
    number,
    kind: 'pull_request',
    actionState,
    title,
    owner: 'contextbridge',
    repository,
    url: `https://github.com/contextbridge/${repository}/pull/${number}`,
    ...extra,
  });
}

function issue(number: number, title: string, repository: string, extra: Partial<InboxItem> = {}): InboxItem {
  return inboxItem.build({
    id: `issue-${number}`,
    nodeId: `issue-node-${number}`,
    number,
    kind: 'issue',
    actionState: 'assigned_issue',
    title,
    owner: 'contextbridge',
    repository,
    url: `https://github.com/contextbridge/${repository}/issues/${number}`,
    ...extra,
  });
}
