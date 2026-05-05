import type { ServerContext } from '@contextbridge/server/context';
import { startServer } from '@contextbridge/server/planReview';
import type { RunningServer } from '@contextbridge/server/planReview';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import type { PlanReviewSubmission, SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { CliContext } from '#src/context.ts';
import { extractPlanTitle } from './extractPlanTitle.ts';

export class PlanReviewInterruptedError extends Error {
  constructor(message = 'plan review interrupted by SIGINT') {
    super(message);
    this.name = 'PlanReviewInterruptedError';
  }
}

export interface RunPlanReviewArgs {
  planContent: string;
}

export interface PlanReviewDependencies {
  loadHtml(): Promise<string>;
  startReviewServer(
    ctx: ServerContext,
    args: {
      html: Promise<string>;
      payload: SubmissionPayload;
      config: FrontendConfig;
      checkForUpdate?: () => Promise<UpdateNotice | null>;
    },
  ): RunningServer;
  registerSigintHandler(handler: () => void): () => void;
}

export async function runPlanReview(
  ctx: CliContext,
  args: RunPlanReviewArgs,
  deps: PlanReviewDependencies = defaultPlanReviewDependencies,
): Promise<PlanReviewSubmission> {
  const { logger, openUrl, frontendConfig, updater } = ctx;

  const payload: SubmissionPayload = {
    content: args.planContent,
    title: extractPlanTitle(args.planContent),
  };

  let server: RunningServer | null = null;
  let removeSigintHandler = () => {};
  let closePromise: Promise<void> | null = null;
  let sigintHandled = false;
  let rejectSigint!: (error: Error) => void;
  const sigintPromise = new Promise<never>((_, reject) => {
    rejectSigint = reject;
  });
  void sigintPromise.catch(() => {});

  try {
    // Kick off the plan-UI bundle decode without blocking. The server awaits
    // this lazily on the first GET / so the decode runs in parallel with
    // `Bun.serve` bind + browser launch.
    const htmlPromise = deps.loadHtml();
    htmlPromise.catch((err: unknown) => logger.error({ err }, 'failed to load plan UI bundle'));

    server = deps.startReviewServer(ctx, {
      html: htmlPromise,
      payload,
      config: frontendConfig,
      checkForUpdate: () => updater.checkForUpdate().catch(() => null),
    });
    removeSigintHandler = deps.registerSigintHandler(() => {
      if (sigintHandled) {
        return;
      }

      sigintHandled = true;
      void closeServer();
      rejectSigint(new PlanReviewInterruptedError());
    });

    logger.info({ url: server.url }, 'opening plan-review browser session');
    await Promise.race([openUrl(server.url), sigintPromise]);

    return await Promise.race([server.result, sigintPromise]);
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

const defaultPlanReviewDependencies: PlanReviewDependencies = {
  loadHtml: () => import('./bundledPlanHtml.ts').then((m) => m.bundledPlanHtml),
  startReviewServer: (ctx, { html, payload, config, checkForUpdate }) =>
    startServer(ctx, { html, payload, config, checkForUpdate }),
  registerSigintHandler: (handler) => {
    process.on('SIGINT', handler);
    return () => {
      process.off('SIGINT', handler);
    };
  },
};
