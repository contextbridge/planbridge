import type { PlanReviewSubmission } from '@contextbridge/shared/planReviewSchema';
import { planReviewSubmission } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { claudeHookResponse } from '#src/formatters/plan/claudeHookResponse.ts';
import type { RunPlanReviewArgs } from '#src/planReview/runPlanReview.ts';
import { createStubContext, readErrorLogs } from '#src/testHelpers/index.ts';
import { type HookClaudeDependencies, runHookClaude } from './hookClaude.ts';

describe('hookClaude handler', () => {
  it('emits the approved envelope when the review is approved', async () => {
    const { context, io } = createStubContext();
    const submission = planReviewSubmission.build({ status: 'approved', threads: [] });
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
    expect(deps.calls).toEqual([{ planContent: '# Plan\n\nStep 1.\n' }]);
  });

  it('emits a deny envelope with the markdown feedback when changes are requested', async () => {
    const { context, io } = createStubContext();
    const submission = planReviewSubmission.build();
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

    const expected = claudeHookResponse(submission, planContent);
    expect(io.stdout.text()).toBe(`${JSON.stringify(expected)}\n`);
    const parsed = JSON.parse(io.stdout.text().trim()) as typeof expected;
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
    if (parsed.hookSpecificOutput.decision.behavior !== 'deny') throw new Error('expected deny');
    expect(parsed.hookSpecificOutput.decision.message?.length ?? 0).toBeGreaterThan(0);
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
  calls: RunPlanReviewArgs[];
}

function createHookDependencies(options: { submission?: PlanReviewSubmission } = {}): RecordingHookDependencies {
  const calls: RunPlanReviewArgs[] = [];
  const submission = options.submission ?? planReviewSubmission.build();

  return {
    calls,
    runReview: (_ctx, args) => {
      calls.push(args);
      return Promise.resolve(submission);
    },
  };
}
