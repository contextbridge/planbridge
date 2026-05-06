import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import { PlanReviewApiRoutes } from '@contextbridge/shared/planReviewApiSchema';
import type { PlanReviewSubmission, SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { ServerContext } from './context.ts';

const UPDATE_NOTICE_TIMEOUT_MS = 3_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;

export class PlanReviewSessionAbandonedError extends Error {
  constructor(message = 'plan review abandoned because the browser tab stopped sending heartbeats') {
    super(message);
    this.name = 'PlanReviewSessionAbandonedError';
  }
}

export type CheckForUpdate = () => Promise<UpdateNotice | null>;

export interface StartServerOptions {
  /** Plan UI bundle. Awaited lazily on the first GET /. */
  readonly html: Promise<string>;
  readonly payload: SubmissionPayload;
  readonly config: FrontendConfig;
  readonly port?: number;
  readonly checkForUpdate?: CheckForUpdate;
}

export interface RunningServer {
  readonly port: number;
  readonly url: string;
  readonly result: Promise<PlanReviewSubmission>;
  close(): Promise<void>;
}

export interface PlanReviewServerApp {
  readonly result: Promise<PlanReviewSubmission>;
  fetch: (req: Request) => Promise<Response>;
  close(): void;
}

export function startServer(ctx: ServerContext, opts: StartServerOptions): RunningServer {
  const { logger } = ctx;
  const app = createPlanReviewServerApp(ctx, opts);
  const server = Bun.serve({
    port: opts.port ?? 0,
    fetch: app.fetch,
  });

  const port = server.port ?? 0;
  const url = `http://localhost:${port}`;
  logger.info({ url }, 'plan-review server listening');

  return {
    port,
    url,
    result: app.result,
    close: async () => {
      app.close();
      await server.stop(true);
    },
  };
}

export function createPlanReviewServerApp(ctx: ServerContext, opts: StartServerOptions): PlanReviewServerApp {
  const { html, payload, config, checkForUpdate } = opts;
  const { logger } = ctx;
  const routes = PlanReviewApiRoutes;

  let resolveResult!: (r: PlanReviewSubmission) => void;
  let rejectResult!: (err: Error) => void;
  const result = new Promise<PlanReviewSubmission>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  let settled = false;
  let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    result,
    close: () => {
      clearHeartbeatTimeout();
    },
    fetch: async (req) => {
      const url = new URL(req.url);
      if (req.method === routes.root.method && url.pathname === routes.root.path) {
        try {
          const body = await html;
          armHeartbeatTimeout();
          return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
        } catch (err) {
          logger.error({ err }, 'failed to load plan UI bundle');
          return new Response('failed to load plan UI bundle', { status: 500 });
        }
      }
      if (req.method === routes.config.method && url.pathname === routes.config.path) {
        return Response.json(config);
      }
      if (req.method === routes.payload.method && url.pathname === routes.payload.path) {
        return Response.json(payload);
      }
      if (req.method === routes.updateNotice.method && url.pathname === routes.updateNotice.path) {
        const notice = await resolveUpdateNotice(checkForUpdate);
        return Response.json(notice);
      }
      if (req.method === routes.heartbeat.method && url.pathname === routes.heartbeat.path) {
        armHeartbeatTimeout();
        return new Response(null, { status: 204 });
      }
      if (req.method === routes.submit.method && url.pathname === routes.submit.path) {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return new Response('invalid JSON', { status: 400 });
        }
        const parsed = routes.submit.body.safeParse(body);
        if (!parsed.success) {
          logger.warn({ issues: parsed.error.issues }, 'submission failed schema validation');
          return new Response('invalid submission', { status: 400 });
        }
        // Defer resolution to the next macrotask so Bun can flush the 204
        // onto the socket before the CLI's awaiter unblocks and tears the
        // server down with `server.stop(true)` — otherwise the browser sees
        // the connection reset mid-response. `Connection: close` on the
        // response ensures the browser releases the TCP socket immediately.
        setTimeout(() => settleWithSubmission(parsed.data), 0);
        return new Response(null, { status: 204, headers: { connection: 'close' } });
      }
      return new Response('not found', { status: 404 });
    },
  };

  function armHeartbeatTimeout(): void {
    if (settled) return;
    clearHeartbeatTimeout();
    heartbeatTimeout = setTimeout(() => abandonReview(), HEARTBEAT_TIMEOUT_MS);
  }

  function clearHeartbeatTimeout(): void {
    if (!heartbeatTimeout) return;
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = null;
  }

  function settleWithSubmission(submission: PlanReviewSubmission): void {
    if (settled) return;
    settled = true;
    clearHeartbeatTimeout();
    resolveResult(submission);
  }

  function abandonReview(): void {
    if (settled) return;
    settled = true;
    clearHeartbeatTimeout();
    logger.info('plan-review heartbeat expired; treating browser session as abandoned');
    rejectResult(new PlanReviewSessionAbandonedError());
  }
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
