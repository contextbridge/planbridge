import { annotationPayload, frontendConfig } from '@contextbridge/shared/testFactories';
import { type RunningServer, type StartServerOptions, startServer } from '#src/annotation.ts';
import type { ServerContext } from '#src/context.ts';

const DEFAULT_HTML = '<html><body>ui</body></html>';

export function withServer<T = void>(ctx: ServerContext, fn: (running: RunningServer) => Promise<T>): Promise<T>;
export function withServer<T = void>(
  ctx: ServerContext,
  opts: Partial<StartServerOptions>,
  fn: (running: RunningServer) => Promise<T>,
): Promise<T>;
export async function withServer<T = void>(
  ctx: ServerContext,
  optsOrFn: Partial<StartServerOptions> | ((running: RunningServer) => Promise<T>),
  maybeFn?: (running: RunningServer) => Promise<T>,
): Promise<T> {
  const fn = typeof optsOrFn === 'function' ? optsOrFn : maybeFn!;
  const opts = typeof optsOrFn === 'function' ? {} : optsOrFn;
  const running = startServer(ctx, {
    html: Promise.resolve(DEFAULT_HTML),
    payload: annotationPayload.build(),
    config: frontendConfig.build(),
    ...opts,
  });
  try {
    return await fn(running);
  } finally {
    await running.close();
  }
}
