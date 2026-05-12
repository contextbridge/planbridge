import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { annotationSubmission } from '@contextbridge/shared/testFactories';
import { createDeferred } from '@contextbridge/shared/testHelpers';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { PLAN_TEMPLATES } from '#src/formatters/plan/templates.ts';
import { environment } from '#src/testFactories.ts';
import {
  createAnnotationDependencies,
  createStubContext,
  expectErr,
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

  it('errors cleanly when the file does not exist', async () => {
    const { context, io, logs } = createStubContext();
    io.stdin.isTTY = true;

    const err = await expectErr(runPlan(context, { path: join(tmp, 'missing.md') }));
    expect(err.message).toContain('failed to read plan from file');
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs)).toEqual([]);
  });

  it('errors when neither a path nor piped stdin is supplied', async () => {
    const { context, io, logs } = createStubContext();
    io.stdin.isTTY = true;

    const err = await expectErr(runPlan(context, {}));
    expect(err.message).toContain('provide plan content via stdin');
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs)).toEqual([]);
  });

  it('errors when the plan content is empty / whitespace-only', async () => {
    const { context, io, logs } = createStubContext();
    io.stdin.write('   \n\t  \n');
    io.stdin.end();

    const err = await expectErr(runPlan(context, {}));
    expect(err.message).toContain('plan content is empty');
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs)).toEqual([]);
  });

  it('closes the server and surfaces a runtime error when the browser open fails', async () => {
    const { context, io, logs } = createStubContext({ openUrl: () => Promise.reject(new Error('open failed')) });
    const deps = createAnnotationDependencies();
    io.stdin.write('# Plan\n');
    io.stdin.end();

    const err = await expectErr(runPlan(context, {}, deps));
    expect(err.message).toContain('open failed');
    expect(io.stdout.text()).toBe('');
    expect(deps.closed).toBe(true);
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

    const err = await expectErr(reviewPromise);
    expect(err.kind).toBe('cancelled');
    expect(io.stdout.text()).toBe('');
    expect(deps.closed).toBe(true);
    expect(readLogs(logs).filter((record) => record.level >= 40)).toEqual([]);
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

    const err = await expectErr(reviewPromise);
    expect(err.kind).toBe('cancelled');
    expect(telemetry.exceptions).toEqual([]);
    expect(analytics.captures.some((c) => c.event === 'plan_review_submitted')).toBe(false);
  });
});
