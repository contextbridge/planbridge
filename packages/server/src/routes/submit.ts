import { type AnnotationSubmission, AnnotationSubmissionSchema } from '@contextbridge/shared/annotationSchema';
import type { ServerContext } from '#src/context.ts';

export async function handleSubmit(
  ctx: ServerContext,
  req: Request,
  resolveResult: (s: AnnotationSubmission) => void,
): Promise<Response> {
  const { logger } = ctx;

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
