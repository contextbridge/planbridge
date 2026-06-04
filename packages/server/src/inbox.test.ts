import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import type { InboxFilters, InboxSnapshot } from '@contextbridge/shared/inboxSchema';
import { describe, expect, it } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { type InboxRouteService, startInboxServer } from './inbox.ts';

describe('startInboxServer', () => {
  const ctx = fakeBaseContext();

  it('serves the provided HTML at GET /', async () => {
    const running = startInboxServer(ctx, { html: Promise.resolve('<html>inbox</html>'), inboxService: fakeService() });
    try {
      const res = await fetch(running.url);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toBe('<html>inbox</html>');
    } finally {
      await running.close();
    }
  });

  it('returns a validated snapshot from GET /api/inbox/snapshot', async () => {
    const calls: InboxFilters[] = [];
    const running = startInboxServer(ctx, {
      html: Promise.resolve('<html></html>'),
      inboxService: fakeService({
        getInbox: (filters) => {
          calls.push(filters);
          return okAsync(snapshot({ filters }));
        },
      }),
    });

    try {
      const res = await fetch(`${running.url}/api/inbox/snapshot?kinds=pull_request,issue&includeDrafts=true`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        viewer: 'octocat',
        filters: { kinds: ['pull_request', 'issue'], includeDrafts: true },
      });
      expect(calls[0]).toMatchObject({ kinds: ['pull_request', 'issue'], includeDrafts: true });
    } finally {
      await running.close();
    }
  });

  it('returns typed errors for service failures', async () => {
    const running = startInboxServer(ctx, {
      html: Promise.resolve('<html></html>'),
      inboxService: fakeService({
        getInbox: () => errAsync({ code: 'gh_auth', message: 'run gh auth login' }),
      }),
    });

    try {
      const res = await fetch(`${running.url}/api/inbox/snapshot`);
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: { code: 'gh_auth', message: 'run gh auth login' } });
    } finally {
      await running.close();
    }
  });

  it('opens GitHub URLs and rejects unsafe URLs', async () => {
    const opened: string[] = [];
    const running = startInboxServer(ctx, {
      html: Promise.resolve('<html></html>'),
      inboxService: fakeService({
        openItem: (url) => {
          opened.push(url);
          return okAsync(undefined);
        },
      }),
    });

    try {
      const good = await fetch(`${running.url}/api/inbox/open`, {
        method: 'POST',
        body: JSON.stringify({ url: 'https://github.com/contextbridge/example/pull/1' }),
      });
      expect(good.status).toBe(200);
      expect(opened).toEqual(['https://github.com/contextbridge/example/pull/1']);

      const bad = await fetch(`${running.url}/api/inbox/open`, {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com/nope' }),
      });
      expect(bad.status).toBe(400);
    } finally {
      await running.close();
    }
  });
});

function fakeService(overrides: Partial<InboxRouteService> = {}): InboxRouteService {
  return {
    getInbox: (filters) => okAsync(snapshot({ filters })),
    openItem: () => okAsync(undefined),
    ...overrides,
  };
}

function snapshot({ filters = {} }: { filters?: InboxFilters } = {}): InboxSnapshot {
  return {
    viewer: 'octocat',
    generatedAt: '2026-01-01T00:00:00Z',
    filters,
    items: [],
  };
}
