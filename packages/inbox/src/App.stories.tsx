import type { Meta, StoryObj } from '@storybook/react-vite';
import { inboxItem, inboxSnapshot } from './testFactories.ts';
import { App, LoadedInbox } from './App.tsx';
import { createInboxApiClient } from './apiClient.ts';
import type { InboxApiClient } from './apiClient.ts';

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

function fakeApiClient(snapshotOverrides?: Parameters<typeof inboxSnapshot.build>[0]): InboxApiClient {
  const data = inboxSnapshot.build(snapshotOverrides);
  return {
    async fetchSnapshot() {
      return data;
    },
    async openItem() {},
  };
}

export const Default: Story = {
  render: () => <App apiClient={fakeApiClient()} />,
};

export const Empty: Story = {
  render: () => <App apiClient={fakeApiClient({ items: [] })} />,
};

export const WithItems: Story = {
  render: () => (
    <App
      apiClient={fakeApiClient({
        items: [
          inboxItem.build({
            priority: 'urgent',
            priorityScore: 180,
            reasons: ['review_requested', 'ci_failing'],
            title: 'Fix production crash in auth handler',
            kind: 'pull_request',
          }),
          inboxItem.build({
            priority: 'high',
            priorityScore: 100,
            reasons: ['review_requested'],
            title: 'Refactor database connection pool',
            kind: 'pull_request',
          }),
          inboxItem.build({
            priority: 'normal',
            priorityScore: 60,
            reasons: ['assigned_to_me'],
            title: 'Update dependency versions',
            kind: 'issue',
          }),
          inboxItem.build({
            priority: 'low',
            priorityScore: -30,
            reasons: ['dependabot'],
            title: 'Bump eslint from 9.0.0 to 9.1.0',
            kind: 'pull_request',
            isDraft: false,
          }),
        ],
      })}
    />
  ),
};
