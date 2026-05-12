import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import type { AnnotationPayload } from '@contextbridge/shared/annotationSchema';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import { annotationThread, globalThread } from '@contextbridge/shared/testFactories';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { UpdateOutcome } from '@contextbridge/shared/updateOutcomeSchema';
import { describe, expect, it, mock } from 'bun:test';
import { createAnnotationServerApp, startServer } from './annotation.ts';

describe('createAnnotationServerApp', () => {
  const payload: AnnotationPayload = {
    content: '# plan',
    contentKind: 'plan',
    metadata: { entrypoint: 'plan_command' },
  };
  const config: FrontendConfig = { distinctId: 'test-distinct-id', telemetryDisabled: false };
  const ctx = fakeBaseContext();

  it('serves the UI html at /', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const res = await app.fetch(new Request('http://localhost/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<body>ui</body>');
  });

  it('awaits a Promise<string> for html so callers can begin loading the bundle off the critical path', async () => {
    let resolveHtml!: (html: string) => void;
    const htmlPromise = new Promise<string>((resolve) => {
      resolveHtml = resolve;
    });
    const app = createAnnotationServerApp(ctx, { html: htmlPromise, payload, config });

    const responsePromise = app.fetch(new Request('http://localhost/'));
    resolveHtml('<html><body>deferred</body></html>');
    const res = await responsePromise;

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<body>deferred</body>');
  });

  it('returns 500 when the html promise rejects', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.reject(new Error('bundle missing')),
      payload,
      config,
    });
    const res = await app.fetch(new Request('http://localhost/'));
    expect(res.status).toBe(500);
  });

  it('serves the submission payload at /payload', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const res = await app.fetch(new Request('http://localhost/payload'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it('serves the frontend config at /config', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const res = await app.fetch(new Request('http://localhost/config'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(config);
  });

  it('resolves the result promise on a valid POST /submit', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const submission = {
      status: 'changes_requested' as const,
      threads: [annotationThread.build(), globalThread.build()],
    };

    const res = await app.fetch(
      new Request('http://localhost/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
      }),
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('connection')).toBe('close');
    expect(await app.result).toEqual(submission);
  });

  it('returns 400 when the submission fails schema validation', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const res = await app.fetch(
      new Request('http://localhost/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'maybe', threads: [] }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown routes', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const res = await app.fetch(new Request('http://localhost/nope'));
    expect(res.status).toBe(404);
  });

  it('/update-notice returns null when no checkForUpdate callback is provided', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const res = await app.fetch(new Request('http://localhost/update-notice'));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('/update-notice invokes checkForUpdate on demand and returns the resolved notice', async () => {
    const notice: UpdateNotice = {
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      channel: 'stable',
    };
    let calls = 0;
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      checkForUpdate: () => {
        calls++;
        return Promise.resolve(notice);
      },
    });
    const res = await app.fetch(new Request('http://localhost/update-notice'));
    expect(await res.json()).toEqual(notice);
    expect(calls).toBe(1);
  });

  it('/update-notice returns null when checkForUpdate rejects', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      checkForUpdate: () => Promise.reject(new Error('boom')),
    });
    const res = await app.fetch(new Request('http://localhost/update-notice'));
    expect(await res.json()).toBeNull();
  });

  it('/update-notice returns null when checkForUpdate never resolves within the timeout', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      // Never resolves — the 3s server-side timeout should fire.
      checkForUpdate: () => new Promise(() => {}),
    });
    // Prove the handler IS waiting (not returning synchronously) by racing
    // against a tight external timeout — if the handler returned early we'd
    // see the json, but we should instead see 'still pending' because the
    // handler is still awaiting the server-side timeout.
    const notice: unknown = await Promise.race([
      app.fetch(new Request('http://localhost/update-notice')).then((r) => r.json()),
      new Promise((resolve) => setTimeout(() => resolve('still pending'), 50)),
    ]);
    expect(notice).toBe('still pending');
  });
});

describe('startServer', () => {
  const payload: AnnotationPayload = {
    content: '# plan',
    contentKind: 'plan',
    metadata: { entrypoint: 'plan_command' },
  };
  const config: FrontendConfig = { distinctId: 'test-distinct-id', telemetryDisabled: false };
  const ctx = fakeBaseContext();

  // Regression test for the submit→close race: the /submit response must be
  // fully delivered to the client even though the CLI tears the server down
  // immediately after `running.result` resolves. Pre-fix, this failed with a
  // connection-reset network error because `resolveResult` fired synchronously
  // and `server.stop(true)` ran before Bun flushed the 204.
  it('delivers the /submit response even when close() runs right after result resolves', async () => {
    const running = startServer(ctx, { html: Promise.resolve('<html><body>ui</body></html>'), payload, config });
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

  it('returns 404 for POST /update when no performUpdate callback is wired', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });

    const res = await app.fetch(new Request('http://localhost/update', { method: 'POST' }));

    expect(res.status).toBe(404);
  });

  it('returns the UpdateOutcome from performUpdate on POST /update', async () => {
    const performUpdate = mock(() =>
      Promise.resolve<UpdateOutcome>({ status: 'failed', message: 'broken', recoverable: true }),
    );
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      performUpdate,
    });

    const res = await app.fetch(new Request('http://localhost/update', { method: 'POST' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'failed', message: 'broken', recoverable: true });
    expect(performUpdate).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent POST /update requests via a single in-flight promise', async () => {
    let resolvePerform!: (outcome: UpdateOutcome) => void;
    const performUpdate = mock(
      () =>
        new Promise<UpdateOutcome>((resolve) => {
          resolvePerform = resolve;
        }),
    );
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      performUpdate,
    });

    const first = app.fetch(new Request('http://localhost/update', { method: 'POST' }));
    const second = app.fetch(new Request('http://localhost/update', { method: 'POST' }));
    // Yield once so both routes register their await on the same in-flight promise
    // before we resolve it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolvePerform({ status: 'success' });

    const [firstRes, secondRes] = await Promise.all([first, second]);
    expect(await firstRes.json()).toEqual({ status: 'success' });
    expect(await secondRes.json()).toEqual({ status: 'success' });
    expect(performUpdate).toHaveBeenCalledTimes(1);
  });

  it('returns a recoverable failure when performUpdate throws', async () => {
    const performUpdate = mock(() => Promise.reject(new Error('boom')));
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      performUpdate,
    });

    const res = await app.fetch(new Request('http://localhost/update', { method: 'POST' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; message: string; recoverable: boolean };
    expect(body.status).toBe('failed');
    expect(body.recoverable).toBe(true);
    expect(body.message).toMatch(/contextbridge update/);
  });

  it('clears the in-flight slot after the update settles', async () => {
    const performUpdate = mock(() => Promise.resolve<UpdateOutcome>({ status: 'success' }));
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      performUpdate,
    });

    await app.fetch(new Request('http://localhost/update', { method: 'POST' }));
    await app.fetch(new Request('http://localhost/update', { method: 'POST' }));

    expect(performUpdate).toHaveBeenCalledTimes(2);
  });

  it('awaitInFlightUpdate resolves immediately when nothing is in flight', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });

    await app.awaitInFlightUpdate();
  });

  it('awaitInFlightUpdate waits for a pending update to settle', async () => {
    let resolvePerform!: (outcome: UpdateOutcome) => void;
    const performUpdate = mock(
      () =>
        new Promise<UpdateOutcome>((resolve) => {
          resolvePerform = resolve;
        }),
    );
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      performUpdate,
    });

    void app.fetch(new Request('http://localhost/update', { method: 'POST' }));
    // Yield once so the route can register the in-flight promise.
    await new Promise((resolve) => setTimeout(resolve, 0));

    let resolved = false;
    const wait = app.awaitInFlightUpdate().then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);

    resolvePerform({ status: 'success' });
    await wait;
    expect(resolved).toBe(true);
  });

  it('awaitInFlightUpdate resolves on timeout without throwing if the update is still pending', async () => {
    const performUpdate = mock(() => new Promise<UpdateOutcome>(() => {}));
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
      performUpdate,
    });

    void app.fetch(new Request('http://localhost/update', { method: 'POST' }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    await app.awaitInFlightUpdate(20);
  });
});
