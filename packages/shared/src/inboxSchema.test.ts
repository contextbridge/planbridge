import { describe, expect, it } from 'bun:test';
import { inboxFiltersSchema, inboxSnapshotSchema, openInboxItemRequestSchema } from './inboxSchema.ts';

describe('inbox schemas', () => {
  it('parses a valid snapshot', () => {
    const snapshot = inboxSnapshotSchema.parse({
      viewer: 'octocat',
      generatedAt: '2026-01-01T00:00:00Z',
      filters: { kinds: ['pull_request'], includeDrafts: false },
      items: [
        {
          id: '1',
          nodeId: 'PR_kwDO',
          number: 42,
          kind: 'pull_request',
          title: 'Fix bug',
          url: 'https://github.com/contextbridge/example/pull/42',
          repository: 'example',
          owner: 'contextbridge',
          state: 'open',
          isDraft: false,
          author: { login: 'alice' },
          assignees: [{ login: 'octocat' }],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          priority: 'high',
          priorityScore: 100,
          reasons: ['review_requested'],
        },
      ],
    });

    expect(snapshot.items[0]).toMatchObject({ title: 'Fix bug', priority: 'high' });
  });

  it('rejects empty required strings', () => {
    const result = inboxSnapshotSchema.safeParse({
      viewer: '',
      generatedAt: '2026-01-01T00:00:00Z',
      filters: {},
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it('parses filters', () => {
    expect(
      inboxFiltersSchema.parse({
        repositories: ['contextbridge/example'],
        kinds: ['issue'],
        timeWindow: 'week',
        includeDrafts: true,
      }),
    ).toMatchObject({
      repositories: ['contextbridge/example'],
      kinds: ['issue'],
      timeWindow: 'week',
      includeDrafts: true,
    });
  });

  it('rejects non-GitHub open URLs', () => {
    expect(openInboxItemRequestSchema.safeParse({ url: 'https://example.com/nope' }).success).toBe(false);
  });
});
