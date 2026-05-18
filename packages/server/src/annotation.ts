import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import type { ServerContext } from './context.ts';
import { handleAsset } from './routes/assets.ts';
import { handleConfig } from './routes/config.ts';
import { handleHtml } from './routes/html.ts';
import { handlePayload } from './routes/payload.ts';
import { handleSubmit } from './routes/submit.ts';
import { type CheckForUpdate, handleUpdateNotice } from './routes/updateNotice.ts';

export interface StartServerOptions {
  /** Annotation UI bundle. Awaited lazily on the first GET /. */
  readonly html: Promise<string>;
  readonly payload: AnnotationPayload;
  readonly config: FrontendConfig;
  readonly port?: number;
  readonly checkForUpdate?: CheckForUpdate;
}

export interface RunningServer {
  readonly port: number;
  readonly url: string;
  readonly result: Promise<AnnotationSubmission>;
  close(): Promise<void>;
}

export function startServer(ctx: ServerContext, opts: StartServerOptions): RunningServer {
  const { logger } = ctx;
  const { html, payload, config, checkForUpdate } = opts;

  let resolveResult!: (r: AnnotationSubmission) => void;
  const result = new Promise<AnnotationSubmission>((resolve) => {
    resolveResult = resolve;
  });

  const server = Bun.serve({
    port: resolveListenPort(opts),
    routes: {
      '/': { GET: () => handleHtml(ctx, html) },
      '/assets/:id': { GET: (req) => handleAsset(payload, req.params.id) },
      '/config': { GET: () => handleConfig(config) },
      '/payload': { GET: () => handlePayload(payload) },
      '/update-notice': { GET: () => handleUpdateNotice(checkForUpdate) },
      '/submit': { POST: (req) => handleSubmit(ctx, req, resolveResult) },
    },
    fetch: () => new Response('not found', { status: 404 }),
  });

  const port = server.port ?? 0;
  const url = `http://localhost:${port}`;
  logger.info({ url }, 'annotation server listening');

  return {
    port,
    url,
    result,
    close: () => server.stop(true),
  };
}

export function resolveListenPort(opts: Pick<StartServerOptions, 'port'>): number {
  const { port = 0 } = opts;
  return port;
}
