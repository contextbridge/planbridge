import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { SettingsStoreError } from '@contextbridge/shared/settingsStore';
import { annotationSubmission } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { type RunAnnotationArgs, runAnnotation } from '#src/annotation/runAnnotation.ts';
import { type ClaudeHookResponse, claudeHookResponse } from '#src/formatters/plan/claudeHookResponse.ts';
import { annotationArgs, claudeHookPayload } from '#src/testFactories.ts';
import { type FakeIo, createAnnotationDependencies, createStubContext, readErrorLogs } from '#src/testHelpers/index.ts';
import { type HookClaudeDependencies, runHookClaude } from './hookClaude.ts';

describe('hookClaude handler', () => {
  it('emits the approved envelope echoing tool_input and the default auto mode when the review is approved', async () => {
    const { context, io } = createStubContext();
    const submission = annotationSubmission.build({ status: 'approved', threads: [] });
    const deps = createHookDependencies({ submission });
    const payload = claudeHookPayload.build();
    io.stdin.write(JSON.stringify(payload));
    io.stdin.end();

    await runHookClaude(context, deps);

    expect(io.stdout.text()).toBe(`${JSON.stringify(claudeHookResponse(submission, payload.tool_input, 'auto'))}\n`);
    const decision = readAllowDecision(io);
    expect(decision.updatedInput).toEqual(payload.tool_input);
    expect(decision.updatedPermissions).toEqual([{ type: 'setMode', mode: 'auto', destination: 'session' }]);
    expect(deps.calls).toEqual([annotationArgs.build({ content: payload.tool_input.plan, entrypoint: 'hook_claude' })]);
  });

  it('exits into the plan approval mode configured in settings', async () => {
    const { context, io, settingsStore } = createStubContext();
    await settingsStore.patch({ harnesses: { claude: { planApprovalMode: 'default' } } });
    const deps = createHookDependencies({
      submission: annotationSubmission.build({ status: 'approved', threads: [] }),
    });
    io.stdin.write(JSON.stringify(claudeHookPayload.build()));
    io.stdin.end();

    await runHookClaude(context, deps);

    expect(readAllowDecision(io).updatedPermissions).toEqual([
      { type: 'setMode', mode: 'default', destination: 'session' },
    ]);
  });

  it('resolves the plan approval mode after the review, so a mid-review change takes effect', async () => {
    const { context, io, settingsStore } = createStubContext();
    const submission = annotationSubmission.build({ status: 'approved', threads: [] });
    const deps: HookClaudeDependencies = {
      runReview: async () => {
        await settingsStore.patch({ harnesses: { claude: { planApprovalMode: 'acceptEdits' } } });
        return submission;
      },
    };
    io.stdin.write(JSON.stringify(claudeHookPayload.build()));
    io.stdin.end();

    await runHookClaude(context, deps);

    expect(readAllowDecision(io).updatedPermissions).toEqual([
      { type: 'setMode', mode: 'acceptEdits', destination: 'session' },
    ]);
  });

  it('aborts when the settings store cannot resolve the plan approval mode', () => {
    const { context, io, logs, settingsStore } = createStubContext();
    settingsStore.readError = new SettingsStoreError('conflict', 'settings file is not a valid settings document');
    const deps = createHookDependencies({
      submission: annotationSubmission.build({ status: 'approved', threads: [] }),
    });
    io.stdin.write(JSON.stringify(claudeHookPayload.build()));
    io.stdin.end();

    expect(runHookClaude(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(
      readErrorLogs(logs).some((r) => r.msg.includes('could not read settings to resolve plan approval mode')),
    ).toBe(true);
  });

  it('emits a deny envelope with the markdown feedback when changes are requested', async () => {
    const { context, io } = createStubContext();
    const submission = annotationSubmission.build();
    const deps = createHookDependencies({ submission });
    const payload = claudeHookPayload.build();
    io.stdin.write(JSON.stringify(payload));
    io.stdin.end();

    await runHookClaude(context, deps);

    const expected = claudeHookResponse(submission, payload.tool_input, 'auto');
    expect(io.stdout.text()).toBe(`${JSON.stringify(expected)}\n`);
    const parsed = JSON.parse(io.stdout.text().trim()) as typeof expected;
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
    if (parsed.hookSpecificOutput.decision.behavior !== 'deny') throw new Error('expected deny');
    expect(parsed.hookSpecificOutput.decision.message?.length ?? 0).toBeGreaterThan(0);
  });

  it('captures plan-review lifecycle analytics through the shared runner', async () => {
    const { context, io, analytics } = createStubContext();
    const submission = annotationSubmission.build({ status: 'approved', threads: [] });
    const deps: HookClaudeDependencies = {
      runReview: (reviewCtx, args) => runAnnotation(reviewCtx, args, createAnnotationDependencies({ submission })),
    };
    io.stdin.write(JSON.stringify(claudeHookPayload.build()));
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
    io.stdin.write(JSON.stringify(claudeHookPayload.build({ hook_event_name: 'PreToolUse' })));
    io.stdin.end();

    expect(runHookClaude(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('unsupported hook_event_name: PreToolUse'))).toBe(true);
    expect(deps.calls).toEqual([]);
  });

  it('aborts when PermissionRequest arrives for a tool other than ExitPlanMode', () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies();
    io.stdin.write(JSON.stringify(claudeHookPayload.build({ tool_name: 'Bash' })));
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

type AllowDecision = Extract<ClaudeHookResponse['hookSpecificOutput']['decision'], { behavior: 'allow' }>;

function readAllowDecision(io: FakeIo): AllowDecision {
  const parsed = JSON.parse(io.stdout.text().trim()) as ClaudeHookResponse;
  const decision = parsed.hookSpecificOutput.decision;
  if (decision.behavior !== 'allow') throw new Error('expected allow');
  return decision;
}

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
