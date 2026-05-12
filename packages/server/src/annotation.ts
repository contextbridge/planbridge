import {
  type AnnotationPayload,
  type AnnotationSubmission,
  AnnotationSubmissionSchema,
} from '@contextbridge/shared/annotationSchema';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { ServerContext } from './context.ts';

const UPDATE_NOTICE_TIMEOUT_MS = 3_000;

export type CheckForUpdate = () => Promise<UpdateNotice | null>;

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

export interface AnnotationServerApp {
  readonly result: Promise<AnnotationSubmission>;
  fetch: (req: Request) => Promise<Response>;
}

export function startServer(ctx: ServerContext, opts: StartServerOptions): RunningServer {
  const { logger } = ctx;
  const app = createAnnotationServerApp(ctx, opts);
  const server = Bun.serve({
    port: opts.port ?? 0,
    fetch: app.fetch,
  });

  const port = server.port ?? 0;
  const url = `http://localhost:${port}`;
  logger.info({ url }, 'annotation server listening');

  return {
    port,
    url,
    result: app.result,
    close: () => server.stop(true),
  };
}

export function createAnnotationServerApp(ctx: ServerContext, opts: StartServerOptions): AnnotationServerApp {
  const { html, payload, config, checkForUpdate } = opts;
  const { logger } = ctx;

  let resolveResult!: (r: AnnotationSubmission) => void;
  const result = new Promise<AnnotationSubmission>((resolve) => {
    resolveResult = resolve;
  });

  return {
    result,
    fetch: async (req) => {
      const url = new URL(req.url);
      if (req.method === 'GET' && url.pathname === '/') {
        try {
          const body = await html;
          return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
        } catch (err) {
          logger.error({ err }, 'failed to load annotation UI bundle');
          return new Response('failed to load annotation UI bundle', { status: 500 });
        }
      }
      if (req.method === 'GET' && url.pathname === '/config') {
        return Response.json(config);
      }
      if (req.method === 'GET' && url.pathname === '/payload') {
        return Response.json(payload);
      }
      if (req.method === 'GET' && url.pathname === '/update-notice') {
        const notice = await resolveUpdateNotice(checkForUpdate);
        return Response.json(notice);
      }
      if (req.method === 'POST' && url.pathname === '/submit') {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return new Response('invalid JSON', { status: 400 });
        }
        const parsed = AnnotationSubmissionSchema.safeParse(body);
        if (!parsed.success) {
          logger.warn({ issues: parsed.error.issues }, 'submission failed schema validation');
          return new Response('invalid submission', { status: 400 });
        }
        // Defer resolution to the next macrotask so Bun can flush the 204
        // onto the socket before the CLI's awaiter unblocks and tears the
        // server down with `server.stop(true)` — otherwise the browser sees
        // the connection reset mid-response. `Connection: close` on the
        // response ensures the browser releases the TCP socket immediately.
        setTimeout(() => resolveResult(parsed.data), 0);
        return new Response(null, { status: 204, headers: { connection: 'close' } });
      }
      return new Response('not found', { status: 404 });
    },
  };
}

async function resolveUpdateNotice(checkForUpdate: CheckForUpdate | undefined): Promise<UpdateNotice | null> {
  if (!checkForUpdate) return null;
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), UPDATE_NOTICE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve().then(checkForUpdate), timeout]);
  } catch {
    return null;
  }
}
