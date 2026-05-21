import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { describe, expect, it } from 'bun:test';
import { startReviewServer } from './review.ts';

describe('startReviewServer', () => {
  const ctx = fakeBaseContext();

  it('serves the provided HTML at GET /', async () => {
    const html = '<html><body>review scaffold</body></html>';
    const running = startReviewServer(ctx, { html: Promise.resolve(html) });
    try {
      const res = await fetch(running.url);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toBe(html);
    } finally {
      await running.close();
    }
  });

  it('returns 404 for unknown routes', async () => {
    const running = startReviewServer(ctx, { html: Promise.resolve('<html></html>') });
    try {
      const res = await fetch(`${running.url}/nope`);
      expect(res.status).toBe(404);
    } finally {
      await running.close();
    }
  });
});
