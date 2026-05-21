import type { ServerContext } from './context.ts';

export interface StartReviewServerOptions {
  /** Review UI bundle. Awaited lazily on the first GET /. */
  readonly html: Promise<string>;
  readonly port?: number;
}

export interface RunningReviewServer {
  readonly port: number;
  readonly url: string;
  /**
   * Resolves once the browser submits a completed review. Never resolves in
   * the current scaffold (no /submit route yet); the CLI relies on a SIGINT
   * race to unblock. The feature PR replaces this with a `ReviewSubmission`.
   */
  readonly result: Promise<void>;
  close(): Promise<void>;
}

export function startReviewServer(ctx: ServerContext, opts: StartReviewServerOptions): RunningReviewServer {
  const { logger } = ctx;
  const { html, port = 0 } = opts;

  const result = new Promise<void>(() => {});

  const server = Bun.serve({
    port,
    routes: {
      '/': { GET: () => serveHtml(ctx, html) },
    },
    fetch: () => new Response('not found', { status: 404 }),
  });

  const resolvedPort = server.port ?? 0;
  const url = `http://localhost:${resolvedPort}`;
  logger.info({ url }, 'review server listening');

  return {
    port: resolvedPort,
    url,
    result,
    close: () => server.stop(true),
  };
}

async function serveHtml(ctx: ServerContext, html: Promise<string>): Promise<Response> {
  const { logger } = ctx;
  try {
    return new Response(await html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (err) {
    logger.error({ err }, 'failed to load review UI bundle');
    return new Response('failed to load review UI bundle', { status: 500 });
  }
}
