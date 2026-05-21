import type { ServerContext } from '@contextbridge/server/context';
import {
  type RunningReviewServer,
  type StartReviewServerOptions,
  startReviewServer,
} from '@contextbridge/server/review';
import { getErrorMessage } from '@contextbridge/shared/errors';
import { type Command, CommanderError, InvalidArgumentError } from 'commander';
import {
  AnnotationEnvironmentError,
  AnnotationInterruptedError,
  isLikelyLocalServerNetworkSandboxError,
} from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { parsePort } from '#src/environment.ts';
import { abort } from './abort.ts';

export interface ReviewArgs {
  port?: number;
}

export interface ReviewDependencies {
  loadHtml(): Promise<string>;
  startReviewServer(ctx: ServerContext, opts: StartReviewServerOptions): RunningReviewServer;
  registerSigintHandler(handler: () => void): () => void;
}

export const reviewScaffoldStdout =
  '[WIP] Review session ended. The review surface is still being scaffolded; no feedback was captured.\n';

export async function runReview(
  ctx: CliContext,
  args: ReviewArgs,
  deps: ReviewDependencies = defaultReviewDependencies,
): Promise<void> {
  const { io, logger, openUrl, env } = ctx;
  const { port = env.CONTEXTBRIDGE_PORT } = args;

  let server: RunningReviewServer | null = null;
  let removeSigintHandler = () => {};
  let closePromise: Promise<void> | null = null;
  let sigintHandled = false;
  let rejectSigint!: (error: Error) => void;
  const sigintPromise = new Promise<never>((_, reject) => {
    rejectSigint = reject;
  });
  void sigintPromise.catch(() => {});

  try {
    const htmlPromise = deps.loadHtml();
    htmlPromise.catch((err: unknown) => logger.error({ err }, 'failed to load review UI bundle'));

    try {
      server = deps.startReviewServer(ctx, { html: htmlPromise, port });
    } catch (err) {
      if (isLikelyLocalServerNetworkSandboxError(err, port ?? 0)) {
        throw new AnnotationEnvironmentError(err);
      }
      throw err;
    }

    removeSigintHandler = deps.registerSigintHandler(() => {
      if (sigintHandled) {
        return;
      }

      sigintHandled = true;
      void closeServer();
      rejectSigint(new AnnotationInterruptedError('review interrupted by SIGINT'));
    });

    logger.info({ url: server.url }, 'opening review browser session');
    await Promise.race([openUrl(server.url), sigintPromise]);
    await Promise.race([server.result, sigintPromise]);

    io.writeStdout(reviewScaffoldStdout);
  } catch (err) {
    if (err instanceof AnnotationInterruptedError) {
      logger.info('review interrupted');
      throw new CommanderError(130, 'contextbridge.review.sigint', 'review interrupted');
    }
    if (err instanceof AnnotationEnvironmentError) {
      abort(ctx, 'review', 'environment', err.message);
    }
    abort(ctx, 'review', 'runtime', getErrorMessage(err));
  } finally {
    removeSigintHandler();
    await closeServer();
  }

  function closeServer(): Promise<void> {
    if (!server) {
      return Promise.resolve();
    }

    closePromise ??= server.close();
    return closePromise;
  }
}

export function registerReview(ctx: CliContext, program: Command): void {
  program
    .command('review')
    .summary('[WIP] Open a PlanBridge code-review session on the current changes.')
    .description(
      '[WIP — under active development] Open the PlanBridge code-review browser UI for the current changes, leave inline comments on the diff, and write the markdown feedback to stdout.',
    )
    .option('--port <number>', 'serve the review browser UI on a specific port', parsePortOption)
    .action(async (opts: { port?: number }) => {
      await runReview(ctx, { port: opts.port });
    });
}

function parsePortOption(value: string): number {
  try {
    return parsePort(value);
  } catch {
    throw new InvalidArgumentError('port must be an integer between 1 and 65535');
  }
}

const defaultReviewDependencies: ReviewDependencies = {
  loadHtml: () => import('#src/review/bundledReviewHtml.ts').then((m) => m.bundledReviewHtml),
  startReviewServer: (ctx, opts) => startReviewServer(ctx, opts),
  registerSigintHandler: (handler) => {
    process.on('SIGINT', handler);
    return () => {
      process.off('SIGINT', handler);
    };
  },
};
