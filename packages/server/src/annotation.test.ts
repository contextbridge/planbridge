import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { annotationPayload, frontendConfig } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { resolveListenPort, startServer } from './annotation.ts';
import { withServer } from './testHelpers.ts';

describe('startServer', () => {
  const ctx = fakeBaseContext();

  it('uses port 0 by default so the OS chooses an available port', () => {
    expect(resolveListenPort({})).toBe(0);
  });

  it('uses a configured port when supplied', () => {
    expect(resolveListenPort({ port: 3456 })).toBe(3456);
  });

  it('returns 404 for unknown routes', async () => {
    await withServer(ctx, async (running) => {
      const res = await fetch(`${running.url}/nope`);
      expect(res.status).toBe(404);
    });
  });

  // Regression test for the submit→close race: the /submit response must be
  // fully delivered to the client even though the CLI tears the server down
  // immediately after `running.result` resolves. Pre-fix, this failed with a
  // connection-reset network error because `resolveResult` fired synchronously
  // and `server.stop(true)` ran before Bun flushed the 204.
  it('delivers the /submit response even when close() runs right after result resolves', async () => {
    const running = startServer(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload: annotationPayload.build(),
      config: frontendConfig.build(),
    });
    const submission = {
      status: 'approved' as const,
      threads: [],
    };

    try {
      const submitFetch = fetch(`${running.url}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
      });

      await running.result;
      await running.close();

      const response = await submitFetch;
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
    } finally {
      await running.close();
    }
  });
});
