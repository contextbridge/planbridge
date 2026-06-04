import type { InboxFilters, InboxSnapshot } from '@contextbridge/shared/inboxSchema';
import {
  inboxFiltersSchema,
  openInboxItemRequestSchema,
  openInboxItemResponseSchema,
} from '@contextbridge/shared/inboxSchema';
import type { ResultAsync } from 'neverthrow';
import type { ServerContext } from './context.ts';

export interface InboxRouteError {
  readonly code: string;
  readonly message: string;
}

export interface InboxRouteService {
  getInbox(filters: InboxFilters): ResultAsync<InboxSnapshot, InboxRouteError>;
  openItem(url: string): ResultAsync<void, InboxRouteError>;
}

export interface StartInboxServerOptions {
  /** Inbox UI bundle. Awaited lazily on the first GET /. */
  readonly html: Promise<string>;
  readonly inboxService: InboxRouteService;
  readonly port?: number;
}

export interface RunningInboxServer {
  readonly port: number;
  readonly url: string;
  readonly result: Promise<void>;
  close(): Promise<void>;
}

export function startInboxServer(ctx: ServerContext, opts: StartInboxServerOptions): RunningInboxServer {
  const { logger } = ctx;
  const { html, inboxService, port = 0 } = opts;
  const result = new Promise<void>(() => {});

  const server = Bun.serve({
    port,
    routes: {
      '/': { GET: () => serveHtml(ctx, html) },
      '/health': { GET: () => Response.json({ ok: true }) },
      '/api/inbox/snapshot': { GET: (request) => serveSnapshot(request, inboxService) },
      '/api/inbox/open': { POST: (request) => openInboxItem(request, inboxService) },
    },
    fetch: () => new Response('not found', { status: 404 }),
  });

  const resolvedPort = server.port ?? 0;
  const url = `http://localhost:${resolvedPort}`;
  logger.info({ url }, 'inbox server listening');

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
    logger.error({ err }, 'failed to load inbox UI bundle');
    return new Response('failed to load inbox UI bundle', { status: 500 });
  }
}

async function serveSnapshot(request: Request, inboxService: InboxRouteService): Promise<Response> {
  const filters = parseFilters(new URL(request.url).searchParams);
  if (!filters.success) return errorResponse('invalid_filters', filters.error.message, 400);

  const result = await inboxService.getInbox(filters.data);
  return result.match(
    (snapshot) => Response.json(snapshot),
    (error) => errorResponse(error.code, error.message, statusForError(error.code)),
  );
}

async function openInboxItem(request: Request, inboxService: InboxRouteService): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid_request', 'request body must be JSON', 400);
  }

  const parsed = openInboxItemRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse('invalid_request', 'request body must include a GitHub URL', 400);

  const result = await inboxService.openItem(parsed.data.url);
  return result.match(
    () => Response.json(openInboxItemResponseSchema.parse({ opened: true })),
    (error) => errorResponse(error.code, error.message, statusForError(error.code)),
  );
}

function parseFilters(searchParams: URLSearchParams): ReturnType<typeof inboxFiltersSchema.safeParse> {
  const filters: Record<string, unknown> = {};
  setIfDefined(filters, 'repositories', listParam(searchParams, 'repositories'));
  setIfDefined(filters, 'kinds', listParam(searchParams, 'kinds'));
  setIfDefined(filters, 'includeDrafts', booleanParam(searchParams, 'includeDrafts'));
  setIfDefined(filters, 'includeDependabot', booleanParam(searchParams, 'includeDependabot'));
  return inboxFiltersSchema.safeParse(filters);
}

function listParam(searchParams: URLSearchParams, name: string): string[] | undefined {
  const values = searchParams
    .getAll(name)
    .flatMap((value) => value.split(','))
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
}

function booleanParam(searchParams: URLSearchParams, name: string): boolean | undefined {
  const value = searchParams.get(name);
  if (value === null) return undefined;
  return value === 'true';
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function setIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) target[key] = value;
}

function statusForError(code: string): number {
  if (code === 'gh_missing' || code === 'gh_auth') return 503;
  if (code === 'invalid_json' || code === 'invalid_data') return 502;
  if (code === 'invalid_request' || code === 'invalid_filters') return 400;
  return 500;
}
