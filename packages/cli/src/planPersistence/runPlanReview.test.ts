import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { PlanNotFoundError } from '@contextbridge/storage';
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import type { PlanRevisionService } from '#src/context.ts';
import { createStubContext } from '#src/testHelpers/index.ts';
import { formatPlanIdDirective } from './planIdDirective.ts';
import { InvalidPlanIdError, UnknownPlanIdError, runPlanReview } from './runPlanReview.ts';

describe('runPlanReview', () => {
  test('persists a new plan when no plan id is supplied', async () => {
    const service = createTrackingPlanService();
    const { context } = createStubContext({ planService: service });

    const result = await runPlanReview(
      context,
      { content: '# v1', entrypoint: 'hook_claude' },
      { runReview: () => Promise.resolve(changesRequestedSubmission) },
    );

    expect(service.calls).toEqual([{ planId: undefined, content: '# v1' }]);
    expect(result.metadata?.plan).toMatchObject({ revisionNumber: 1 });
  });

  test('attaches a revision to the plan id carried by a hidden directive and strips the marker', async () => {
    const service = createTrackingPlanService();
    const { context } = createStubContext({ planService: service });
    const content = `${formatPlanIdDirective('plan-7')}\n# revised`;

    const result = await runPlanReview(
      context,
      { content, entrypoint: 'hook_claude' },
      { runReview: () => Promise.resolve(changesRequestedSubmission) },
    );

    expect(service.calls).toEqual([{ planId: 'plan-7', content: '# revised' }]);
    expect(result.content).toBe('# revised');
    expect(result.metadata?.plan).toMatchObject({ id: 'plan-7', revisionNumber: 2 });
  });

  test('attaches a revision to an explicit plan id', async () => {
    const service = createTrackingPlanService();
    const { context } = createStubContext({ planService: service });

    await runPlanReview(
      context,
      { content: '# revised', entrypoint: 'plan_command', explicitPlanId: 'plan-9' },
      { runReview: () => Promise.resolve(changesRequestedSubmission) },
    );

    expect(service.calls).toEqual([{ planId: 'plan-9', content: '# revised' }]);
  });

  test('throws InvalidPlanIdError on an empty explicit plan id', () => {
    const { context } = createStubContext({ planService: createTrackingPlanService() });

    expect(
      runPlanReview(
        context,
        { content: '# v1', entrypoint: 'plan_command', explicitPlanId: '   ' },
        { runReview: () => Promise.resolve(changesRequestedSubmission) },
      ),
    ).rejects.toBeInstanceOf(InvalidPlanIdError);
  });

  test('throws UnknownPlanIdError when the referenced plan is missing', () => {
    const service: PlanRevisionService = { createRevision: (args) => errAsync(new PlanNotFoundError(args.planId!)) };
    const { context } = createStubContext({ planService: service });

    expect(
      runPlanReview(
        context,
        { content: '# revised', entrypoint: 'plan_command', explicitPlanId: 'ghost' },
        { runReview: () => Promise.resolve(changesRequestedSubmission) },
      ),
    ).rejects.toBeInstanceOf(UnknownPlanIdError);
  });
});

const changesRequestedSubmission: AnnotationSubmission = { status: 'changes_requested', threads: [] };

function createTrackingPlanService(): PlanRevisionService & {
  readonly calls: { planId: string | undefined; content: string }[];
} {
  const calls: { planId: string | undefined; content: string }[] = [];
  return {
    get calls() {
      return calls;
    },
    createRevision: (args) => {
      calls.push({ planId: args.planId, content: args.content });
      const planId = args.planId ?? `plan-${calls.length}`;
      return okAsync({
        planId,
        revisionId: `revision-${calls.length}`,
        revisionNumber: args.planId ? 2 : 1,
        previousRevisionId: args.planId ? 'revision-previous' : null,
      });
    },
  };
}
