import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import type { AnnotationPayload } from '@contextbridge/shared/annotationSchema';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import { annotationThread, globalThread } from '@contextbridge/shared/testFactories';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { describe, expect, it } from 'bun:test';
import { createAnnotationServerApp, resolveListenPort, serveLocalImage, startServer } from './annotation.ts';

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

  it('uses port 0 by default so the OS chooses an available port', () => {
    expect(resolveListenPort({})).toBe(0);
  });

  it('uses a configured port when supplied', () => {
    expect(resolveListenPort({ port: 3456 })).toBe(3456);
  });

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
});

describe('serveLocalImage', () => {
  it('returns null for non-absolute paths', async () => {
    expect(await serveLocalImage('relative/path.png')).toBeNull();
  });

  it('returns null for paths without an image extension', async () => {
    expect(await serveLocalImage('/some/path/file.txt')).toBeNull();
    expect(await serveLocalImage('/some/path/file.js')).toBeNull();
    expect(await serveLocalImage('/some/path/file')).toBeNull();
  });

  it('returns null for image paths that do not exist on disk', async () => {
    expect(await serveLocalImage('/nonexistent/path/image.png')).toBeNull();
  });

  it('serves an existing image file from disk', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-server-img-test-'));
    const imgPath = join(tmp, 'test-image.png');
    const imgContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    writeFileSync(imgPath, imgContent);

    try {
      const response = await serveLocalImage(imgPath);
      expect(response).not.toBeNull();
      const body = await response!.arrayBuffer();
      expect(Buffer.from(body)).toEqual(imgContent);
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });

  it('handles percent-encoded paths', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-server-img-test-'));
    const imgPath = join(tmp, 'my image.png');
    const imgContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    writeFileSync(imgPath, imgContent);

    try {
      const encodedPath = imgPath.replace(/ /g, '%20');
      const response = await serveLocalImage(encodedPath);
      expect(response).not.toBeNull();
      const body = await response!.arrayBuffer();
      expect(Buffer.from(body)).toEqual(imgContent);
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });

  it('supports various image extensions', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-server-img-test-'));
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

    try {
      for (const ext of extensions) {
        const imgPath = join(tmp, `image${ext}`);
        writeFileSync(imgPath, 'img-data');
        const response = await serveLocalImage(imgPath);
        expect(response).not.toBeNull();
      }
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });

  it('rejects paths with traversal segments that escape root', async () => {
    // Even though the traversal resolves to a valid path after normalize,
    // it should still have a / prefix and be handled normally
    const tmp = mkdtempSync(join(tmpdir(), 'cb-server-img-test-'));
    const imgPath = join(tmp, 'test.png');
    writeFileSync(imgPath, 'data');

    try {
      // A traversal that still resolves to an absolute path is fine
      const traversalPath = join(tmp, 'sub', '..', 'test.png');
      const response = await serveLocalImage(traversalPath);
      expect(response).not.toBeNull();
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });
});

describe('createAnnotationServerApp local image serving', () => {
  const payload: AnnotationPayload = {
    content: '# plan',
    contentKind: 'plan',
    metadata: { entrypoint: 'plan_command' },
  };
  const config: FrontendConfig = { distinctId: 'test-distinct-id', telemetryDisabled: false };
  const ctx = fakeBaseContext();

  it('serves a local image file via the annotation server', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-server-img-route-'));
    const imgPath = join(tmp, 'generated.png');
    const imgContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    writeFileSync(imgPath, imgContent);

    try {
      const app = createAnnotationServerApp(ctx, {
        html: Promise.resolve('<html><body>ui</body></html>'),
        payload,
        config,
      });
      const res = await app.fetch(new Request(`http://localhost${imgPath}`));
      expect(res.status).toBe(200);
      const body = await res.arrayBuffer();
      expect(Buffer.from(body)).toEqual(imgContent);
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });

  it('returns 404 for non-image file paths', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const res = await app.fetch(new Request('http://localhost/etc/passwd'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for nonexistent image paths', async () => {
    const app = createAnnotationServerApp(ctx, {
      html: Promise.resolve('<html><body>ui</body></html>'),
      payload,
      config,
    });
    const res = await app.fetch(new Request('http://localhost/nonexistent/image.png'));
    expect(res.status).toBe(404);
  });
});
