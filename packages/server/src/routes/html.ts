import type { ServerContext } from '#src/context.ts';

export async function handleHtml(ctx: ServerContext, html: Promise<string>): Promise<Response> {
  const { logger } = ctx;
  try {
    const body = await html;
    return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (err) {
    logger.error({ err }, 'failed to load annotation UI bundle');
    return new Response('failed to load annotation UI bundle', { status: 500 });
  }
}
