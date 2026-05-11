import type { ServerContext } from '@contextbridge/server/context';
import { startServer } from '@contextbridge/server/planReview';
import type { PerformUpdate, RunningServer } from '@contextbridge/server/planReview';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import type { PerformUpdateResult } from '@contextbridge/shared/performUpdateResultSchema';
import type { PlanReviewSource, PlanReviewSubmission, SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import { nowInstant } from '@contextbridge/shared/time';
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
  source: PlanReviewSource;
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
      performUpdate?: PerformUpdate;
    },
  ): RunningServer;
  registerSigintHandler(handler: () => void): () => void;
}

export async function runPlanReview(
  ctx: CliContext,
  args: RunPlanReviewArgs,
  deps: PlanReviewDependencies = defaultPlanReviewDependencies,
): Promise<PlanReviewSubmission> {
  const { analytics, logger, openUrl, frontendConfig, updater } = ctx;
  const startedAt = nowInstant();

  const payload: SubmissionPayload = {
    content: args.planContent,
    title: extractPlanTitle(args.planContent),
    metadata: { source: args.source },
  };
  analytics.capture('plan_review_started', { source: args.source });

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
      performUpdate: buildPerformUpdate(updater),
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

    const submittedReview = await Promise.race([server.result, sigintPromise]);
    analytics.capture('plan_review_submitted', {
      status: submittedReview.status,
      threads_count: submittedReview.threads.length,
      duration_ms: nowInstant().epochMilliseconds - startedAt.epochMilliseconds,
    });
    return submittedReview;
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
  startReviewServer: (ctx, { html, payload, config, checkForUpdate, performUpdate }) =>
    startServer(ctx, { html, payload, config, checkForUpdate, performUpdate }),
  registerSigintHandler: (handler) => {
    process.on('SIGINT', handler);
    return () => {
      process.off('SIGINT', handler);
    };
  },
};

function buildPerformUpdate(updater: CliContext['updater']): PerformUpdate {
  return async (): Promise<PerformUpdateResult> => {
    try {
      const result = await updater.performUpdate();
      switch (result.status) {
        case 'executed':
          return { status: 'success', message: 'Update complete. Restart contextbridge to use the new version.' };
        case 'skipped-already-latest':
          return { status: 'success', message: `Already on the latest version (v${result.currentVersion}).` };
        case 'refused':
        case 'recovery-needed':
        case 'error':
          return { status: 'error', message: result.message };
        default:
          return { status: 'error', message: 'Unexpected update result.' };
      }
    } catch {
      return { status: 'error', message: 'Update failed unexpectedly.' };
    }
  };
}
