import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import type { SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import { annotationThread, globalThread } from '@contextbridge/shared/testFactories';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { describe, expect, it } from 'bun:test';
import {
  PlanReviewSessionAbandonedError,
  type StartServerOptions,
  createPlanReviewServerApp,
  startServer,
} from './planReview.ts';
import { FakeScheduleTimeout, fakeServerContext } from './testHelpers.ts';

const payload: SubmissionPayload = { content: '# plan', metadata: { source: 'file' } };
const config: FrontendConfig = { distinctId: 'test-distinct-id', telemetryDisabled: false };

function defaultOpts(overrides: Partial<StartServerOptions> = {}): StartServerOptions {
  return { html: Promise.resolve('<html><body>ui</body></html>'), payload, config, ...overrides };
}

async function withApp(
  opts: StartServerOptions,
  fn: (app: ReturnType<typeof createPlanReviewServerApp>) => Promise<void> | void,
): Promise<void> {
  const ctx = fakeServerContext();
  const app = createPlanReviewServerApp(ctx, opts);
  try {
    await fn(app);
  } finally {
    app.close();
  }
}

describe('createPlanReviewServerApp', () => {
  it('serves the UI html at /', async () => {
    await withApp(defaultOpts(), async (app) => {
      const res = await app.fetch(new Request('http://localhost/'));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toContain('<body>ui</body>');
    });
  });

  it('awaits a Promise<string> for html so callers can begin loading the bundle off the critical path', async () => {
    let resolveHtml!: (html: string) => void;
    const htmlPromise = new Promise<string>((resolve) => {
      resolveHtml = resolve;
    });
    await withApp(defaultOpts({ html: htmlPromise }), async (app) => {
      const responsePromise = app.fetch(new Request('http://localhost/'));
      resolveHtml('<html><body>deferred</body></html>');
      const res = await responsePromise;

      expect(res.status).toBe(200);
      expect(await res.text()).toContain('<body>deferred</body>');
    });
  });

  it('returns 500 when the html promise rejects', async () => {
    await withApp(defaultOpts({ html: Promise.reject(new Error('bundle missing')) }), async (app) => {
      const res = await app.fetch(new Request('http://localhost/'));
      expect(res.status).toBe(500);
    });
  });

  it('serves the submission payload at /payload', async () => {
    await withApp(defaultOpts(), async (app) => {
      const res = await app.fetch(new Request('http://localhost/payload'));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(payload);
    });
  });

  it('serves the frontend config at /config', async () => {
    await withApp(defaultOpts(), async (app) => {
      const res = await app.fetch(new Request('http://localhost/config'));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(config);
    });
  });

  it('resolves the result promise on a valid POST /submit', async () => {
    await withApp(defaultOpts(), async (app) => {
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
  });

  it('returns 400 when the submission fails schema validation', async () => {
    await withApp(defaultOpts(), async (app) => {
      const res = await app.fetch(
        new Request('http://localhost/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'maybe', threads: [] }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  it('returns 404 for unknown routes', async () => {
    await withApp(defaultOpts(), async (app) => {
      const res = await app.fetch(new Request('http://localhost/nope'));
      expect(res.status).toBe(404);
    });
  });

  it('/update-notice returns null when no checkForUpdate callback is provided', async () => {
    await withApp(defaultOpts(), async (app) => {
      const res = await app.fetch(new Request('http://localhost/update-notice'));
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });
  });

  it('/update-notice invokes checkForUpdate on demand and returns the resolved notice', async () => {
    const notice: UpdateNotice = {
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      channel: 'stable',
    };
    let calls = 0;
    await withApp(
      defaultOpts({
        checkForUpdate: () => {
          calls++;
          return Promise.resolve(notice);
        },
      }),
      async (app) => {
        const res = await app.fetch(new Request('http://localhost/update-notice'));
        expect(await res.json()).toEqual(notice);
        expect(calls).toBe(1);
      },
    );
  });

  it('/update-notice returns null when checkForUpdate rejects', async () => {
    await withApp(defaultOpts({ checkForUpdate: () => Promise.reject(new Error('boom')) }), async (app) => {
      const res = await app.fetch(new Request('http://localhost/update-notice'));
      expect(await res.json()).toBeNull();
    });
  });

  it('/update-notice returns null when checkForUpdate never resolves within the timeout', async () => {
    await withApp(defaultOpts({ checkForUpdate: () => new Promise(() => {}) }), async (app) => {
      const notice: unknown = await Promise.race([
        app.fetch(new Request('http://localhost/update-notice')).then((r) => r.json()),
        new Promise((resolve) => setTimeout(() => resolve('still pending'), 50)),
      ]);
      expect(notice).toBe('still pending');
    });
  });
});

describe('heartbeat', () => {
  it('responds with 204 to POST /heartbeat', async () => {
    await withApp(defaultOpts(), async (app) => {
      const res = await app.fetch(new Request('http://localhost/heartbeat', { method: 'POST' }));
      expect(res.status).toBe(204);
    });
  });

  it('rejects result with PlanReviewSessionAbandonedError when heartbeat timeout expires after GET /', async () => {
    const timer = new FakeScheduleTimeout();
    const ctx = fakeServerContext({ scheduleTimeout: timer.fn });
    const app = createPlanReviewServerApp(ctx, defaultOpts());

    try {
      await app.fetch(new Request('http://localhost/'));
      timer.fireLast();

      expect(app.result).rejects.toBeInstanceOf(PlanReviewSessionAbandonedError);
    } finally {
      app.close();
    }
  });

  it('passes the configured heartbeatTimeoutMs to scheduleTimeout', async () => {
    const timer = new FakeScheduleTimeout();
    const ctx = fakeServerContext({ scheduleTimeout: timer.fn });
    const app = createPlanReviewServerApp(ctx, defaultOpts({ heartbeatTimeoutMs: 5_000 }));

    try {
      await app.fetch(new Request('http://localhost/'));
      expect(timer.scheduled[0]!.delayMs).toBe(5_000);
    } finally {
      app.close();
    }
  });

  it('does not abandon when heartbeats keep arriving', async () => {
    const timer = new FakeScheduleTimeout();
    const ctx = fakeServerContext({ scheduleTimeout: timer.fn });
    const app = createPlanReviewServerApp(ctx, defaultOpts());

    try {
      await app.fetch(new Request('http://localhost/'));
      const res1 = await app.fetch(new Request('http://localhost/heartbeat', { method: 'POST' }));
      expect(res1.status).toBe(204);
      const res2 = await app.fetch(new Request('http://localhost/heartbeat', { method: 'POST' }));
      expect(res2.status).toBe(204);

      // Only the latest timer matters — earlier ones were cancelled.
      // Fire the first scheduled timer (from GET /); it was cancelled so
      // the result should still be pending.
      timer.scheduled[0]!.fire();

      const settled = await Promise.race([
        app.result.then(() => 'resolved').catch(() => 'rejected'),
        new Promise((resolve) => setTimeout(() => resolve('pending'), 10)),
      ]);
      expect(settled).toBe('pending');
    } finally {
      app.close();
    }
  });

  it('submission wins over heartbeat timeout', async () => {
    const timer = new FakeScheduleTimeout();
    const ctx = fakeServerContext({ scheduleTimeout: timer.fn });
    const app = createPlanReviewServerApp(ctx, defaultOpts());

    try {
      await app.fetch(new Request('http://localhost/'));

      const submission = { status: 'approved' as const, threads: [] };
      await app.fetch(
        new Request('http://localhost/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(submission),
        }),
      );

      const result = await app.result;
      expect(result).toEqual(submission);

      // Firing the timer after submission should be a no-op
      timer.fireLast();
      expect(await app.result).toEqual(submission);
    } finally {
      app.close();
    }
  });

  it('close() clears timers without rejecting result', async () => {
    const timer = new FakeScheduleTimeout();
    const ctx = fakeServerContext({ scheduleTimeout: timer.fn });
    const app = createPlanReviewServerApp(ctx, defaultOpts());

    await app.fetch(new Request('http://localhost/'));
    app.close();

    // Firing after close should be a no-op (cancel was called)
    timer.fireLast();

    const settled = await Promise.race([
      app.result.then(() => 'resolved').catch(() => 'rejected'),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 10)),
    ]);
    expect(settled).toBe('pending');
  });
});

describe('startServer', () => {
  it('delivers the /submit response even when close() runs right after result resolves', async () => {
    const ctx = fakeServerContext();
    const running = startServer(ctx, defaultOpts());
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
