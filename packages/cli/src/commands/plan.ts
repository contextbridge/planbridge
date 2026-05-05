import { getErrorMessage } from '@contextbridge/shared/errors';
import { nowInstant } from '@contextbridge/shared/time';
import { type Command, CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';
import { formatAsMarkdown } from '#src/formatters/plan/markdown.ts';
import {
  type PlanReviewDependencies,
  PlanReviewInterruptedError,
  runPlanReview,
} from '#src/planReview/runPlanReview.ts';
import { readStreamToString } from '#src/streams.ts';

export interface PlanArgs {
  path?: string;
}

export async function runPlan(ctx: CliContext, args: PlanArgs, deps?: PlanReviewDependencies): Promise<void> {
  const { io, logger, analytics } = ctx;
  const { path } = args;
  const startedAt = nowInstant();

  if (!path && io.stdin.isTTY === true) {
    abort(
      ctx,
      'input',
      'provide plan content via stdin (e.g. `cat plan.md | contextbridge plan`) or a file path via [path]',
    );
  }

  const source: 'file' | 'stdin' = path ? 'file' : 'stdin';
  let content: string;
  try {
    content = path ? await Bun.file(path).text() : await readStreamToString(io.stdin);
  } catch (err) {
    abort(ctx, 'input', `failed to read plan from ${source}: ${getErrorMessage(err)}`);
  }

  if (content.trim().length === 0) {
    abort(ctx, 'input', 'plan content is empty');
  }

  logger.info({ source, bytes: Buffer.byteLength(content, 'utf8') }, 'plan received');
  analytics.capture('plan_review_started', { source });

  try {
    const submission = await runPlanReview(ctx, { planContent: content }, deps);
    io.stdout.write(formatAsMarkdown(submission, content));
    analytics.capture('plan_review_submitted', {
      status: submission.status,
      threads_count: submission.threads.length,
      duration_ms: nowInstant().epochMilliseconds - startedAt.epochMilliseconds,
    });
  } catch (err) {
    if (err instanceof PlanReviewInterruptedError) {
      logger.info('plan review interrupted');
      throw new CommanderError(130, 'contextbridge.plan.sigint', 'plan review interrupted');
    }
    abort(ctx, 'runtime', getErrorMessage(err));
  }
}

export function registerPlan(ctx: CliContext, program: Command): void {
  program
    .command('plan')
    .description(
      'Run a PlanBridge plan review: reads the plan from stdin or [path], opens a local browser UI for a human to approve or annotate, and writes the markdown result to stdout.',
    )
    .argument('[path]', 'path to a file containing the plan (alternative to stdin)')
    .action(async (path: string | undefined) => {
      await runPlan(ctx, { path });
    });
}

function abort(ctx: CliContext, kind: 'input' | 'runtime', message: string): never {
  const { logger } = ctx;
  // 'input' is user-recoverable — logged at warn so Sentry's pinoIntegration
  // (error/fatal only) doesn't forward it. 'runtime' is a genuine failure.
  if (kind === 'input') {
    logger.warn(message);
  } else {
    logger.error(message);
  }
  throw new CommanderError(1, `contextbridge.plan.${kind}Error`, message);
}
