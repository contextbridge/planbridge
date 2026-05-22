import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { annotationSubmission } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { type RunAnnotationArgs, runAnnotation } from '#src/annotation/runAnnotation.ts';
import { claudeHookResponse } from '#src/formatters/plan/claudeHookResponse.ts';
import { annotationArgs } from '#src/testFactories.ts';
import {
  createAnnotationDependencies,
  createStubContext,
  extractPlanId,
  loadOnlyPersistedReview,
  loadPersistedPlan,
  readErrorLogs,
} from '#src/testHelpers/index.ts';
import { type HookClaudeDependencies, runHookClaude } from './hookClaude.ts';

describe('hookClaude handler', () => {
  it('emits the approved envelope when the review is approved', async () => {
    const { context, io, planRepository } = createStubContext();
    const submission = annotationSubmission.build({ status: 'approved', threads: [] });
    const deps = createHookDependencies({ submission });
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/work',
        permission_mode: 'plan',
        hook_event_name: 'PermissionRequest',
        tool_name: 'ExitPlanMode',
        tool_input: { plan: '# Plan\n\nStep 1.\n' },
      }),
    );
    io.stdin.end();

    await runHookClaude(context, deps);

    expect(io.stdout.text()).toBe(`${JSON.stringify(claudeHookResponse(submission, '# Plan\n\nStep 1.\n'))}\n`);
    const review = loadOnlyPersistedReview(planRepository);
    expect(review).toMatchObject({
      content: '# Plan\n\nStep 1.\n',
      status: 'approved',
    });
    expect(deps.calls).toEqual([annotationArgs.build({ content: '# Plan\n\nStep 1.\n', entrypoint: 'hook_claude' })]);
  });

  it('emits a deny envelope with the markdown feedback when changes are requested', async () => {
    const { context, io, planRepository } = createStubContext();
    const submission = annotationSubmission.build();
    const deps = createHookDependencies({ submission });
    const planContent = '# Plan\n\nStep 1.\n';
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/work',
        permission_mode: 'plan',
        hook_event_name: 'PermissionRequest',
        tool_name: 'ExitPlanMode',
        tool_input: { plan: planContent },
      }),
    );
    io.stdin.end();

    await runHookClaude(context, deps);

    const parsed = JSON.parse(io.stdout.text().trim()) as ReturnType<typeof claudeHookResponse>;
    if (parsed.hookSpecificOutput.decision.behavior !== 'deny') throw new Error('expected deny');
    const planId = extractPlanId(parsed.hookSpecificOutput.decision.message ?? '');
    const expected = claudeHookResponse(submission, planContent, { planId });
    expect(io.stdout.text()).toBe(`${JSON.stringify(expected)}\n`);
    const review = loadPersistedPlan(planRepository, planId);
    expect(review).toMatchObject({ id: planId, projectRoot: '/work', status: submission.status });
    expect(review.revisions[0]).toMatchObject({
      content: planContent,
      status: submission.status,
    });
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
    expect(parsed.hookSpecificOutput.decision.message?.length ?? 0).toBeGreaterThan(0);
  });

  it('captures plan-review lifecycle analytics through the shared runner', async () => {
    const { context, io, analytics } = createStubContext();
    const submission = annotationSubmission.build({ status: 'approved', threads: [] });
    const deps: HookClaudeDependencies = {
      runReview: (reviewCtx, args) => runAnnotation(reviewCtx, args, createAnnotationDependencies({ submission })),
    };
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/work',
        permission_mode: 'plan',
        hook_event_name: 'PermissionRequest',
        tool_name: 'ExitPlanMode',
        tool_input: { plan: '# Plan\n\nStep 1.\n' },
      }),
    );
    io.stdin.end();

    await runHookClaude(context, deps);

    const started = analytics.captures.find((c) => c.event === 'plan_review_started');
    expect(started).toBeDefined();
    expect(started?.properties).toEqual({ source: 'hook_claude' });

    const submitted = analytics.captures.find((c) => c.event === 'plan_review_submitted');
    expect(submitted).toBeDefined();
    expect(submitted?.properties?.['status']).toBe('approved');
    expect(submitted?.properties?.['threads_count']).toBe(0);
    expect(typeof submitted?.properties?.['duration_ms']).toBe('number');
  });

  it('aborts when hook_event_name is unsupported', () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies();
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/work',
        hook_event_name: 'PreToolUse',
        tool_name: 'ExitPlanMode',
        tool_input: { plan: '# x' },
      }),
    );
    io.stdin.end();

    expect(runHookClaude(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('unsupported hook_event_name: PreToolUse'))).toBe(true);
    expect(deps.calls).toEqual([]);
  });

  it('aborts when PermissionRequest arrives for a tool other than ExitPlanMode', () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies();
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/work',
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash',
        tool_input: { plan: 'unused' },
      }),
    );
    io.stdin.end();

    expect(runHookClaude(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('unsupported tool for PermissionRequest: Bash'))).toBe(true);
    expect(deps.calls).toEqual([]);
  });

  it('aborts on invalid JSON', () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies();
    io.stdin.write('{not-json');
    io.stdin.end();

    expect(runHookClaude(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('failed to parse hook event JSON'))).toBe(true);
    expect(deps.calls).toEqual([]);
  });

  it('aborts when tool_input.plan is missing', () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies();
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/work',
        hook_event_name: 'PermissionRequest',
        tool_name: 'ExitPlanMode',
        tool_input: {},
      }),
    );
    io.stdin.end();

    expect(runHookClaude(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('invalid hook event payload'))).toBe(true);
    expect(deps.calls).toEqual([]);
  });

  it('aborts when required top-level fields are missing', () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies();
    io.stdin.write(JSON.stringify({ hook_event_name: 'PermissionRequest' }));
    io.stdin.end();

    expect(runHookClaude(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('invalid hook event payload'))).toBe(true);
  });
});

interface RecordingHookDependencies extends HookClaudeDependencies {
  calls: RunAnnotationArgs[];
}

function createHookDependencies(options: { submission?: AnnotationSubmission } = {}): RecordingHookDependencies {
  const calls: RunAnnotationArgs[] = [];
  const submission = options.submission ?? annotationSubmission.build();

  return {
    calls,
    runReview: (_ctx, args) => {
      calls.push(args);
      return Promise.resolve(submission);
    },
  };
}
