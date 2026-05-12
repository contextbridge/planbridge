import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { annotationSubmission } from '@contextbridge/shared/testFactories';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import type { AnnotationDependencies } from '#src/annotation/runAnnotation.ts';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { PLAN_TEMPLATES } from '#src/formatters/plan/templates.ts';
import { createStubContext, readErrorLogs, readLogs, readWarnLogs } from '#src/testHelpers/index.ts';
import { runPlan } from './plan.ts';

describe('plan handler', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cb-plan-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('reads plan content from stdin and emits the review submission', async () => {
    const openedUrls: string[] = [];
    const { context, io } = createStubContext({ openUrl: (url) => (openedUrls.push(url), Promise.resolve()) });
    const expectedSubmission = annotationSubmission.build();
    const deps = createPlanDependencies({ submission: expectedSubmission });
    io.stdin.write('# My plan\n\nStep 1.\n');
    io.stdin.end();

    await runPlan(context, {}, deps);

    expect(io.stdout.text()).toBe(formatAgentResponse(PLAN_TEMPLATES, expectedSubmission, deps.payloads[0]!.content));
    expect(openedUrls).toEqual(['http://localhost:4312']);
    expect(deps.closed).toBe(true);
  });

  it('reads plan content from a positional path', async () => {
    const planPath = join(tmp, 'plan.md');
    writeFileSync(planPath, '# From positional path\n');

    const { context, io } = createStubContext();
    const deps = createPlanDependencies();
    io.stdin.isTTY = true;

    await runPlan(context, { path: planPath }, deps);

    expect(io.stdout.text()).toBe(formatAgentResponse(PLAN_TEMPLATES, deps.submission, deps.payloads[0]!.content));
    expect(deps.payloads[0]?.content).toBe('# From positional path\n');
  });

  it('prefers the positional path when stdin is also piped', async () => {
    const planPath = join(tmp, 'plan.md');
    writeFileSync(planPath, 'from positional path');

    const { context, io } = createStubContext();
    const deps = createPlanDependencies();
    io.stdin.write('from stdin');
    io.stdin.end();

    await runPlan(context, { path: planPath }, deps);

    expect(deps.payloads[0]?.content).toBe('from positional path');
  });

  it('errors cleanly when the file does not exist', () => {
    const { context, io, logs } = createStubContext();
    io.stdin.isTTY = true;

    expect(runPlan(context, { path: join(tmp, 'missing.md') })).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs).some((r) => r.msg.includes('failed to read plan from file'))).toBe(true);
  });

  it('errors when neither a path nor piped stdin is supplied', () => {
    const { context, io, logs } = createStubContext();
    io.stdin.isTTY = true;

    expect(runPlan(context, {})).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs).some((r) => r.msg.includes('provide plan content via stdin'))).toBe(true);
  });

  it('errors when the plan content is empty / whitespace-only', () => {
    const { context, io, logs } = createStubContext();
    io.stdin.write('   \n\t  \n');
    io.stdin.end();

    expect(runPlan(context, {})).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs).some((r) => r.msg.includes('plan content is empty'))).toBe(true);
  });

  it('closes the server and surfaces a runtime error when the browser open fails', () => {
    const { context, io, logs } = createStubContext({ openUrl: () => Promise.reject(new Error('open failed')) });
    const deps = createPlanDependencies();
    io.stdin.write('# Plan\n');
    io.stdin.end();

    expect(runPlan(context, {}, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(deps.closed).toBe(true);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('open failed'))).toBe(true);
  });

  it('closes the server and exits cleanly (without error-level logs) when SIGINT is received', async () => {
    const { context, io, logs } = createStubContext();
    const deps = createPlanDependencies({ result: createDeferred<AnnotationSubmission>().promise });
    io.stdin.write('# Plan\n');
    io.stdin.end();

    const reviewPromise = runPlan(context, {}, deps);
    await deps.sigintHandlerRegistered;
    deps.triggerSigint();

    expect(reviewPromise).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(deps.closed).toBe(true);
    // Interrupt path logs at info level so pinoIntegration doesn't forward it to Sentry.
    expect(readLogs(logs).some((r) => r.msg === 'plan review interrupted')).toBe(true);
    expect(readErrorLogs(logs)).toEqual([]);
  });

  it('captures plan_review_started and plan_review_submitted analytics events', async () => {
    const { context, analytics, io } = createStubContext();
    const deps = createPlanDependencies();
    io.stdin.write('# My plan\n\nStep 1.\n');
    io.stdin.end();

    await runPlan(context, {}, deps);

    const started = analytics.captures.find((c) => c.event === 'plan_review_started');
    expect(started).toBeDefined();
    expect(started?.properties).toEqual({ source: 'plan_command' });

    const submitted = analytics.captures.find((c) => c.event === 'plan_review_submitted');
    expect(submitted).toBeDefined();
    expect(submitted?.properties?.['status']).toBe(deps.submission.status);
    expect(submitted?.properties?.['threads_count']).toBe(deps.submission.threads.length);
    expect(typeof submitted?.properties?.['duration_ms']).toBe('number');
  });

  it('does not report SIGINT to telemetry', async () => {
    const { context, analytics, telemetry, io } = createStubContext();
    const deps = createPlanDependencies({ result: createDeferred<AnnotationSubmission>().promise });
    io.stdin.write('# Plan\n');
    io.stdin.end();

    const reviewPromise = runPlan(context, {}, deps);
    await deps.sigintHandlerRegistered;
    deps.triggerSigint();

    expect(reviewPromise).rejects.toBeInstanceOf(CommanderError);
    expect(telemetry.exceptions).toEqual([]);
    expect(analytics.captures.some((c) => c.event === 'plan_review_submitted')).toBe(false);
  });
});

function createPlanDependencies(
  options: {
    submission?: AnnotationSubmission;
    result?: Promise<AnnotationSubmission>;
  } = {},
): AnnotationDependencies & {
  payloads: AnnotationPayload[];
  closed: boolean;
  sigintHandlerRegistered: Promise<void>;
  submission: AnnotationSubmission;
  triggerSigint(): void;
} {
  const payloads: AnnotationPayload[] = [];
  const submission = options.submission ?? annotationSubmission.build();
  const sigintRegistration = createDeferred<void>();
  let closed = false;
  let sigintHandler: (() => void) | null = null;

  return {
    payloads,
    sigintHandlerRegistered: sigintRegistration.promise,
    get closed() {
      return closed;
    },
    submission,
    triggerSigint() {
      if (!sigintHandler) {
        throw new Error('SIGINT handler was not registered');
      }

      sigintHandler();
    },
    loadHtml: () => Promise.resolve('<html><body>annotation</body></html>'),
    startReviewServer: (_ctx, { payload }) => {
      payloads.push(payload);
      return {
        port: 4312,
        url: 'http://localhost:4312',
        result: options.result ?? Promise.resolve(submission),
        awaitInFlightUpdate: () => Promise.resolve(),
        close: () => {
          closed = true;
          return Promise.resolve();
        },
      };
    },
    registerSigintHandler: (handler) => {
      sigintHandler = handler;
      sigintRegistration.resolve();
      return () => {
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
