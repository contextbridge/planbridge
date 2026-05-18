import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { annotationSubmission } from '@contextbridge/shared/testFactories';
import { createDeferred } from '@contextbridge/shared/testHelpers';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { PLAN_TEMPLATES } from '#src/formatters/plan/templates.ts';
import { environment } from '#src/testFactories.ts';
import {
  createAnnotationDependencies,
  createStubContext,
  readErrorLogs,
  readLogs,
  readWarnLogs,
} from '#src/testHelpers/index.ts';
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
    const deps = createAnnotationDependencies({ submission: expectedSubmission });
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
    const deps = createAnnotationDependencies();
    io.stdin.isTTY = true;

    await runPlan(context, { path: planPath }, deps);

    expect(io.stdout.text()).toBe(formatAgentResponse(PLAN_TEMPLATES, deps.submission, deps.payloads[0]!.content));
    expect(deps.payloads[0]?.content).toBe('# From positional path\n');
  });

  it('forwards args.path as sourcePath to runAnnotation', async () => {
    const planPath = join(tmp, 'plan.md');
    writeFileSync(planPath, '# plan\n');

    const { context, io } = createStubContext();
    const deps = createAnnotationDependencies();
    io.stdin.isTTY = true;

    await runPlan(context, { path: planPath }, deps);

    expect(deps.payloads[0]?.metadata?.sourcePath).toBe(resolvePath(planPath));
  });

  it('prefers the positional path when stdin is also piped', async () => {
    const planPath = join(tmp, 'plan.md');
    writeFileSync(planPath, 'from positional path');

    const { context, io } = createStubContext();
    const deps = createAnnotationDependencies();
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
    const deps = createAnnotationDependencies();
    io.stdin.write('# Plan\n');
    io.stdin.end();

    expect(runPlan(context, {}, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(deps.closed).toBe(true);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('open failed'))).toBe(true);
  });

  it('surfaces local network sandbox bind failures without error-level logs', async () => {
    const { context, io, logs } = createStubContext();
    const deps = createAnnotationDependencies();
    deps.startReviewServer = () => {
      throw Object.assign(new Error('Failed to start server. Is port 0 in use?'), { code: 'EADDRINUSE' });
    };
    io.stdin.write('# Plan\n');
    io.stdin.end();

    const caught = await runPlan(context, {}, deps).then(
      () => null,
      (e: unknown) => e,
    );

    expect(caught).toBeInstanceOf(CommanderError);
    expect((caught as CommanderError).code).toBe('contextbridge.plan.environmentError');
    expect((caught as CommanderError).message).toContain('network sandbox');
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs).some((r) => r.msg.includes('network sandbox'))).toBe(true);
    expect(readErrorLogs(logs)).toEqual([]);
  });

  it('closes the server and exits cleanly (without error-level logs) when SIGINT is received', async () => {
    const { context, io, logs } = createStubContext();
    const deps = createAnnotationDependencies({ result: createDeferred<AnnotationSubmission>().promise });
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
    const deps = createAnnotationDependencies();
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

  it('passes an explicit port to the review server', async () => {
    const { context, io } = createStubContext();
    const deps = createAnnotationDependencies();
    io.stdin.write('# My plan\n');
    io.stdin.end();

    await runPlan(context, { port: 3000 }, deps);

    expect(deps.port).toBe(3000);
  });

  it('lets an explicit port override CONTEXTBRIDGE_PORT', async () => {
    const { context, io } = createStubContext({ env: environment.build({ CONTEXTBRIDGE_PORT: 3456 }) });
    const deps = createAnnotationDependencies();
    io.stdin.write('# My plan\n');
    io.stdin.end();

    await runPlan(context, { port: 3000 }, deps);

    expect(deps.port).toBe(3000);
  });

  it('does not report SIGINT to telemetry', async () => {
    const { context, analytics, telemetry, io } = createStubContext();
    const deps = createAnnotationDependencies({ result: createDeferred<AnnotationSubmission>().promise });
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
