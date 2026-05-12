import type { Fetcher } from '@contextbridge/context';
import type { UpdateOutcome } from '@contextbridge/shared/updateOutcomeSchema';
import { describe, expect, it, vi } from 'vitest';
import { triggerUpdate } from './triggerUpdate.ts';

function makeFetcher(response: Response | Error): Fetcher {
  return {
    fetch: vi.fn(() => {
      if (response instanceof Error) return Promise.reject(response);
      return Promise.resolve(response);
    }),
  };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('triggerUpdate', () => {
  it('parses a success outcome', async () => {
    const fetcher = makeFetcher(jsonResponse({ status: 'success' }));
    const outcome = await triggerUpdate(fetcher);
    expect(outcome).toEqual({ status: 'success' });
  });

  it('parses a recoverable failure outcome', async () => {
    const fetcher = makeFetcher(jsonResponse({ status: 'failed', message: 'oops', recoverable: true }));
    const outcome = await triggerUpdate(fetcher);
    expect(outcome).toEqual({ status: 'failed', message: 'oops', recoverable: true });
  });

  it('POSTs to /update', async () => {
    const fetch = vi.fn(() => Promise.resolve(jsonResponse({ status: 'success' } satisfies UpdateOutcome)));
    const fetcher: Fetcher = { fetch };
    await triggerUpdate(fetcher);
    expect(fetch).toHaveBeenCalledWith('/update', expect.objectContaining({ method: 'POST' }));
  });

  it('returns a generic recoverable failure when the fetch throws', async () => {
    const fetcher = makeFetcher(new Error('network down'));
    const outcome = await triggerUpdate(fetcher);
    expect(outcome.status).toBe('failed');
    if (outcome.status === 'failed') {
      expect(outcome.recoverable).toBe(true);
      expect(outcome.message).toContain('contextbridge update');
    }
  });

  it('returns a generic recoverable failure when the response is not ok', async () => {
    const fetcher = makeFetcher(new Response('boom', { status: 500 }));
    const outcome = await triggerUpdate(fetcher);
    expect(outcome.status).toBe('failed');
    if (outcome.status === 'failed') {
      expect(outcome.recoverable).toBe(true);
    }
  });

  it('returns a generic recoverable failure when the body fails to parse against the schema', async () => {
    const fetcher = makeFetcher(jsonResponse({ status: 'bogus' }));
    const outcome = await triggerUpdate(fetcher);
    expect(outcome.status).toBe('failed');
    if (outcome.status === 'failed') {
      expect(outcome.recoverable).toBe(true);
    }
  });
});
