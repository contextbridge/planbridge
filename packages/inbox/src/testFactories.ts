import type { InboxActor, InboxFilters, InboxItem, InboxLabel, InboxSnapshot } from '@contextbridge/shared/inboxSchema';
import { Factory } from 'fishery';

export const inboxActor = Factory.define<InboxActor>(() => ({
  login: 'octocat',
}));

export const inboxLabel = Factory.define<InboxLabel>(() => ({
  name: 'bug',
  color: 'ff0000',
}));

export const inboxItem = Factory.define<InboxItem>(() => ({
  id: 'item_1',
  nodeId: 'node_1',
  number: 1,
  kind: 'pull_request',
  title: 'Fix critical parsing bug',
  url: 'https://github.com/owner/repo/pull/1',
  repository: 'repo',
  owner: 'owner',
  state: 'open',
  isDraft: false,
  author: inboxActor.build(),
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-15T00:00:00Z',
  actionState: 'needs_my_review',
}));

export const inboxFilters = Factory.define<InboxFilters>(() => ({}));

export const inboxSnapshot = Factory.define<InboxSnapshot>(() => ({
  viewer: 'octocat',
  generatedAt: '2026-06-01T00:00:00Z',
  filters: {},
  items: [inboxItem.build()],
}));
