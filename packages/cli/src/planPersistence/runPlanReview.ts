import type { AnnotationEntrypoint, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { PlanNotFoundError } from '@contextbridge/storage';
import { extractDocumentTitle } from '#src/annotation/extractDocumentTitle.ts';
import {
  type AnnotationDependencies,
  type RunAnnotationArgs,
  type RunAnnotationResult,
  runAnnotation,
} from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { buildPlanRevisionInstructions } from '#src/formatters/plan/revisionInstructions.ts';
import { resolvePlanIdInput } from './planIdDirective.ts';

export type PlanReviewRunner = (
  ctx: CliContext,
  args: RunAnnotationArgs,
) => Promise<RunAnnotationResult | AnnotationSubmission>;

export interface RunPlanReviewArgs {
  readonly content: string;
  readonly entrypoint: AnnotationEntrypoint;
  readonly explicitPlanId?: string;
  readonly port?: number;
  readonly sourcePath?: string;
}

export interface PlanReviewResult {
  readonly content: string;
  readonly submission: AnnotationSubmission;
  readonly metadata: RunAnnotationResult['metadata'];
  readonly revision: ReturnType<typeof buildPlanRevisionInstructions>;
}

export interface RunPlanReviewDependencies {
  readonly runReview?: PlanReviewRunner;
  readonly annotationDeps?: AnnotationDependencies;
}

export class InvalidPlanIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlanIdError';
  }
}

export class UnknownPlanIdError extends Error {
  constructor(planId: string) {
    super(`Unknown plan ID: ${planId}`);
    this.name = 'UnknownPlanIdError';
  }
}

export async function runPlanReview(
  ctx: CliContext,
  args: RunPlanReviewArgs,
  deps: RunPlanReviewDependencies = {},
): Promise<PlanReviewResult> {
  const { logger, planService } = ctx;
  const { content, entrypoint, explicitPlanId, port, sourcePath } = args;

  const resolved = resolvePlanIdInput({ explicitPlanId, content }).match(
    (value) => value,
    (error) => {
      throw new InvalidPlanIdError(error.message);
    },
  );
  const strippedContent = resolved.content;

  const reviewResult = normalizeReviewResult(
    await (deps.runReview ?? defaultRunReview)(ctx, {
      content: strippedContent,
      contentKind: 'plan',
      entrypoint,
      port,
      sourcePath,
    }),
  );

  const created = await planService
    .createRevision({
      planId: resolved.planId ?? undefined,
      sourcePath,
      content: strippedContent,
      title: extractDocumentTitle(strippedContent) ?? null,
    })
    .match(
      (value) => value,
      (error) => {
        if (error instanceof PlanNotFoundError) {
          throw new UnknownPlanIdError(resolved.planId ?? error.message);
        }
        logger.warn({ err: error }, 'failed to persist plan revision');
        return null;
      },
    );

  const metadata = created
    ? {
        ...reviewResult.metadata,
        entrypoint,
        ...(sourcePath ? { sourcePath } : {}),
        plan: {
          id: created.planId,
          revisionId: created.revisionId,
          revisionNumber: created.revisionNumber,
        },
      }
    : reviewResult.metadata;

  return {
    content: strippedContent,
    submission: reviewResult.submission,
    metadata,
    revision: buildPlanRevisionInstructions({ plan: metadata?.plan, entrypoint, sourcePath }),
  };

  function defaultRunReview(reviewCtx: CliContext, reviewArgs: RunAnnotationArgs): Promise<RunAnnotationResult> {
    return runAnnotation(reviewCtx, reviewArgs, deps.annotationDeps);
  }
}

export function normalizeReviewResult(result: RunAnnotationResult | AnnotationSubmission): RunAnnotationResult {
  if ('submission' in result) return result;
  return { submission: result, metadata: undefined };
}
