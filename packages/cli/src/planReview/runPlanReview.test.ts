import { PlanReviewSessionAbandonedError } from '@contextbridge/server/planReview';
import type { PlanReviewSubmission, SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import { planReviewSubmission } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { createStubContext } from '#src/testHelpers/index.ts';
import { PlanReviewAbandonedError, type PlanReviewDependencies, runPlanReview } from './runPlanReview.ts';

describe('runPlanReview', () => {
  it('opens the browser and returns the submitted review', async () => {
    const openedUrls: string[] = [];
    const { context } = createStubContext({ openUrl: (url) => (openedUrls.push(url), Promise.resolve()) });
    const deps = createPlanReviewDependencies();

    const submission = await runPlanReview(context, { planContent: '# Plan' }, deps);

    expect(submission).toEqual(deps.submission);
    expect(openedUrls).toEqual(['http://localhost:4312']);
    expect(deps.payloads).toEqual([{ content: '# Plan', title: 'Plan' }]);
    expect(deps.closeCount).toBe(1);
    expect(deps.sigintHandlerRemoved).toBe(true);
  });

  it('closes the server when opening the browser fails', () => {
    const { context } = createStubContext({ openUrl: () => Promise.reject(new Error('open failed')) });
    const deps = createPlanReviewDependencies();

    expect(runPlanReview(context, { planContent: '# Plan' }, deps)).rejects.toThrow('open failed');
    expect(deps.closeCount).toBe(1);
    expect(deps.sigintHandlerRemoved).toBe(true);
  });

  it('closes the server and rejects when SIGINT is received', async () => {
    const { context } = createStubContext();
    const result = createDeferred<PlanReviewSubmission>();
    const deps = createPlanReviewDependencies({ result: result.promise });

    const reviewPromise = runPlanReview(context, { planContent: '# Plan' }, deps);
    await deps.sigintHandlerRegistered;
    deps.triggerSigint();

    expect(reviewPromise).rejects.toThrow('plan review interrupted by SIGINT');
    expect(deps.closeCount).toBe(1);
    expect(deps.sigintHandlerRemoved).toBe(true);
  });

  it('translates PlanReviewSessionAbandonedError into PlanReviewAbandonedError', () => {
    const { context } = createStubContext();
    const deps = createPlanReviewDependencies({
      result: Promise.reject(new PlanReviewSessionAbandonedError()),
    });

    expect(runPlanReview(context, { planContent: '# Plan' }, deps)).rejects.toBeInstanceOf(PlanReviewAbandonedError);
    expect(deps.closeCount).toBe(1);
    expect(deps.sigintHandlerRemoved).toBe(true);
  });
});

function createPlanReviewDependencies(
  options: {
    result?: Promise<PlanReviewSubmission>;
  } = {},
): PlanReviewDependencies & {
  closeCount: number;
  payloads: SubmissionPayload[];
  sigintHandlerRegistered: Promise<void>;
  sigintHandlerRemoved: boolean;
  submission: PlanReviewSubmission;
  triggerSigint(): void;
} {
  const payloads: SubmissionPayload[] = [];
  const submission = planReviewSubmission.build();
  const sigintRegistration = createDeferred<void>();
  let closeCount = 0;
  let sigintHandler: (() => void) | null = null;
  let sigintHandlerRemoved = false;

  return {
    get closeCount() {
      return closeCount;
    },
    payloads,
    sigintHandlerRegistered: sigintRegistration.promise,
    get sigintHandlerRemoved() {
      return sigintHandlerRemoved;
    },
    submission,
    triggerSigint() {
      if (!sigintHandler) {
        throw new Error('SIGINT handler was not registered');
      }

      sigintHandler();
    },
    loadHtml: () => Promise.resolve('<html><body>plan review</body></html>'),
    startReviewServer: (_ctx, { payload }) => {
      payloads.push(payload);
      return {
        port: 4312,
        url: 'http://localhost:4312',
        result: options.result ?? Promise.resolve(submission),
        close: () => {
          closeCount += 1;
          return Promise.resolve();
        },
      };
    },
    registerSigintHandler: (handler) => {
      sigintHandler = handler;
      sigintHandlerRemoved = false;
      sigintRegistration.resolve();
      return () => {
        sigintHandlerRemoved = true;
        sigintHandler = null;
      };
    },
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
