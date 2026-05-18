import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { createDeferred } from '@contextbridge/shared/testHelpers';
import { describe, expect, it } from 'bun:test';
import { withServer } from '#src/testHelpers.ts';

describe('GET /', () => {
  const ctx = fakeBaseContext();

  it('serves the UI html', async () => {
    await withServer(ctx, async (running) => {
      const res = await fetch(`${running.url}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toContain('<body>ui</body>');
    });
  });

  it('awaits a Promise<string> for html so callers can begin loading the bundle off the critical path', async () => {
    const { promise: htmlPromise, resolve: resolveHtml } = createDeferred<string>();
    await withServer(ctx, { html: htmlPromise }, async (running) => {
      const responsePromise = fetch(`${running.url}/`);

      // Prove the handler is waiting for html — race against a short timeout.
      const settledBefore = await Promise.race([
        responsePromise.then(() => 'fetched'),
        new Promise<string>((resolve) => setTimeout(() => resolve('still pending'), 50)),
      ]);
      expect(settledBefore).toBe('still pending');

      resolveHtml('<html><body>deferred</body></html>');
      const res = await responsePromise;
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('<body>deferred</body>');
    });
  });

  it('returns 500 when the html promise rejects', async () => {
    // The route handler awaits `html` lazily, so the rejection is unhandled
    // from Bun's perspective until a request lands. Suppress the tracker with
    // a no-op .catch — the handler's try/catch still sees the real rejection.
    const html = Promise.reject<string>(new Error('bundle missing'));
    html.catch(() => {});
    await withServer(ctx, { html }, async (running) => {
      const res = await fetch(`${running.url}/`);
      expect(res.status).toBe(500);
    });
  });
});
