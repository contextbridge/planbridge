import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { annotationSubmission } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { AnnotationEnvironmentError, type RunAnnotationArgs, runAnnotation } from '#src/annotation/runAnnotation.ts';
import type { CodexStopResponse } from '#src/formatters/plan/codexStopResponse.ts';
import {
  annotationArgs,
  codexStopHookPayload,
  codexTranscriptHookPromptLine,
  codexTranscriptPlanLine,
} from '#src/testFactories.ts';
import {
  createAnnotationDependencies,
  createStubContext,
  readErrorLogs,
  readWarnLogs,
} from '#src/testHelpers/index.ts';
import type { CodexStopHookPayload } from './codexHookSchema.ts';
import { type HookCodexDependencies, extractLatestPlanFromTranscript, runHookCodex } from './hookCodex.ts';

describe('hookCodex handler', () => {
  it('emits an empty JSON object on approval so Codex uses its native Plan Mode approval flow', async () => {
    const { context, io } = createStubContext();
    const submission = annotationSubmission.build({ status: 'approved', threads: [] });
    const deps = createHookDependencies({
      submission,
      transcript: transcriptWithPlan('# Approved Plan\n\nStep 1.\n'),
    });
    writeStopPayload(io, { transcript_path: '/tmp/codex-transcript.jsonl', last_assistant_message: null });

    await runHookCodex(context, deps);

    expect(io.stdout.text().trim()).toBe('{}');
    expect(deps.calls).toEqual([
      annotationArgs.build({ content: '# Approved Plan\n\nStep 1.', entrypoint: 'hook_codex' }),
    ]);
  });

  it('emits a Stop continuation with review feedback when changes are requested', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({ transcript: transcriptWithPlan('# Plan\n\n- Step 1\n') });
    writeStopPayload(io, { transcript_path: '/tmp/codex-transcript.jsonl', last_assistant_message: null });

    await runHookCodex(context, deps);

    const parsed = JSON.parse(io.stdout.text().trim()) as CodexStopResponse;
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('Plan review: changes requested');
  });

  it('captures plan-review lifecycle analytics through the shared runner', async () => {
    const { context, io, analytics } = createStubContext();
    const submission = annotationSubmission.build({ status: 'approved', threads: [] });
    const deps = createHookDependencies({
      transcript: transcriptWithPlan('# Approved Plan\n\nStep 1.\n'),
      runReview: (reviewCtx, args) => runAnnotation(reviewCtx, args, createAnnotationDependencies({ submission })),
    });
    writeStopPayload(io, { transcript_path: '/tmp/codex-transcript.jsonl', last_assistant_message: null });

    await runHookCodex(context, deps);

    const started = analytics.captures.find((c) => c.event === 'plan_review_started');
    expect(started).toBeDefined();
    expect(started?.properties).toEqual({ source: 'hook_codex' });

    const submitted = analytics.captures.find((c) => c.event === 'plan_review_submitted');
    expect(submitted).toBeDefined();
    expect(submitted?.properties?.['status']).toBe('approved');
    expect(submitted?.properties?.['threads_count']).toBe(0);
    expect(typeof submitted?.properties?.['duration_ms']).toBe('number');
  });

  it('emits an empty JSON object when transcript_path is null', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({ transcript: '' });
    writeStopPayload(io, { transcript_path: null });

    await runHookCodex(context, deps);

    expect(io.stdout.text().trim()).toBe('{}');
    expect(deps.calls).toEqual([]);
  });

  it('emits an empty JSON object when the transcript has no Plan items', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({ transcript: '' });
    writeStopPayload(io, { transcript_path: '/tmp/codex-transcript.jsonl', last_assistant_message: null });

    await runHookCodex(context, deps);

    expect(io.stdout.text().trim()).toBe('{}');
    expect(deps.calls).toEqual([]);
  });

  it('logs an error and emits an empty JSON object when the transcript read fails', async () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies({ transcript: new Error('ENOENT') });
    writeStopPayload(io, { transcript_path: '/tmp/codex-transcript.jsonl', last_assistant_message: null });

    await runHookCodex(context, deps);

    expect(io.stdout.text().trim()).toBe('{}');
    expect(deps.calls).toEqual([]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('failed to read codex transcript'))).toBe(true);
  });

  it('surfaces local network sandbox failures without error-level logs', async () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies({
      transcript: transcriptWithPlan('# Plan\n'),
      runReview: () =>
        Promise.reject(
          new AnnotationEnvironmentError(
            Object.assign(new Error('Failed to start server. Is port 0 in use?'), { code: 'EADDRINUSE' }),
          ),
        ),
    });
    writeStopPayload(io, { transcript_path: '/tmp/codex-transcript.jsonl', last_assistant_message: null });

    const caught = await runHookCodex(context, deps).then(
      () => null,
      (e: unknown) => e,
    );

    expect(caught).toBeInstanceOf(CommanderError);
    expect((caught as CommanderError).code).toBe('contextbridge.hookCodex.environmentError');
    expect((caught as CommanderError).message).toContain('network sandbox');
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs).some((r) => r.msg.includes('network sandbox'))).toBe(true);
    expect(readErrorLogs(logs)).toEqual([]);
  });

  it('reviews an approved proposed_plan tag from last_assistant_message without reading the transcript', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({
      submission: annotationSubmission.build({ status: 'approved', threads: [] }),
    });
    writeStopPayload(io, {
      transcript_path: '/tmp/codex-transcript.jsonl',
      last_assistant_message: '<proposed_plan>\n# Direct Plan\n\n- Step 1\n</proposed_plan>',
    });

    await runHookCodex(context, deps);

    expect(deps.calls).toEqual([
      annotationArgs.build({ content: '# Direct Plan\n\n- Step 1', entrypoint: 'hook_codex' }),
    ]);
    expect(deps.transcriptReadCount).toBe(0);
    expect(io.stdout.text().trim()).toBe('{}');
  });

  it('reviews the latest proposed_plan tag from last_assistant_message', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({
      submission: annotationSubmission.build({ status: 'approved', threads: [] }),
    });
    writeStopPayload(io, {
      transcript_path: '/tmp/codex-transcript.jsonl',
      last_assistant_message: [
        '<proposed_plan>',
        '# Stale Plan',
        '</proposed_plan>',
        '<proposed_plan>',
        '# Latest Plan',
        '</proposed_plan>',
      ].join('\n'),
    });

    await runHookCodex(context, deps);

    expect(deps.calls).toEqual([annotationArgs.build({ content: '# Latest Plan', entrypoint: 'hook_codex' })]);
    expect(deps.transcriptReadCount).toBe(0);
    expect(io.stdout.text().trim()).toBe('{}');
  });

  it('falls back to the current-turn Plan item when last_assistant_message is untagged', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({ transcript: transcriptWithPlan('# Current Plan') });
    writeStopPayload(io, {
      transcript_path: '/tmp/codex-transcript.jsonl',
      last_assistant_message: 'Implementation complete.',
    });

    await runHookCodex(context, deps);

    const parsed = JSON.parse(io.stdout.text().trim()) as CodexStopResponse;
    expect(parsed.decision).toBe('block');
    expect(deps.calls).toEqual([annotationArgs.build({ content: '# Current Plan', entrypoint: 'hook_codex' })]);
    expect(deps.transcriptReadCount).toBe(1);
  });

  it('uses transcript Plan items even when permission_mode is default', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({ transcript: transcriptWithPlan('# Plan') });
    writeStopPayload(io, {
      permission_mode: 'default',
      transcript_path: '/tmp/codex-transcript.jsonl',
      last_assistant_message: 'Confirmed: I have enough repo context to produce a concrete implementation plan now.',
    });

    await runHookCodex(context, deps);

    const parsed = JSON.parse(io.stdout.text().trim()) as CodexStopResponse;
    expect(parsed.decision).toBe('block');
    expect(deps.calls).toEqual([annotationArgs.build({ content: '# Plan', entrypoint: 'hook_codex' })]);
    expect(deps.transcriptReadCount).toBe(1);
  });

  it('does not review stale plans from earlier turns', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({
      transcript: transcriptWithPlan('# Old Plan', 'turn_old'),
    });
    writeStopPayload(io, {
      transcript_path: '/tmp/codex-transcript.jsonl',
      turn_id: 'turn_new',
      last_assistant_message: null,
    });

    await runHookCodex(context, deps);

    expect(io.stdout.text().trim()).toBe('{}');
    expect(deps.calls).toEqual([]);
  });

  it('reviews a revised Plan produced by an active Stop continuation', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({
      transcript: [transcriptWithPlan('# Old Plan'), planReviewHookPrompt(), transcriptWithPlan('# Revised Plan')].join(
        '\n',
      ),
    });
    writeStopPayload(io, { stop_hook_active: true, transcript_path: '/tmp/codex-transcript.jsonl' });

    await runHookCodex(context, deps);

    const parsed = JSON.parse(io.stdout.text().trim()) as CodexStopResponse;
    expect(parsed.decision).toBe('block');
    expect(deps.calls).toEqual([annotationArgs.build({ content: '# Revised Plan', entrypoint: 'hook_codex' })]);
    expect(deps.transcriptReadCount).toBe(1);
  });

  it('does not re-review an active Stop continuation when no new Plan follows the hook prompt', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({
      transcript: [transcriptWithPlan('# Reviewed Plan'), planReviewHookPrompt()].join('\n'),
    });
    writeStopPayload(io, { stop_hook_active: true, transcript_path: '/tmp/codex-transcript.jsonl' });

    await runHookCodex(context, deps);

    expect(io.stdout.text().trim()).toBe('{}');
    expect(deps.calls).toEqual([]);
    expect(deps.transcriptReadCount).toBe(1);
  });

  it('ignores last_assistant_message during an active Stop continuation so stale plans do not loop', async () => {
    const { context, io } = createStubContext();
    const deps = createHookDependencies({
      transcript: [transcriptWithPlan('# Reviewed Plan'), planReviewHookPrompt()].join('\n'),
    });
    writeStopPayload(io, {
      stop_hook_active: true,
      transcript_path: '/tmp/codex-transcript.jsonl',
      last_assistant_message: '<proposed_plan>\n# Reviewed Plan\n</proposed_plan>',
    });

    await runHookCodex(context, deps);

    expect(io.stdout.text().trim()).toBe('{}');
    expect(deps.calls).toEqual([]);
    expect(deps.transcriptReadCount).toBe(1);
  });

  it('aborts on invalid JSON', () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies();
    io.stdin.write('{not-json');
    io.stdin.end();

    expect(runHookCodex(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('failed to parse hook event JSON'))).toBe(true);
  });

  it('aborts when the event payload is not a Codex Stop hook', () => {
    const { context, io, logs } = createStubContext();
    const deps = createHookDependencies();
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: null,
        cwd: '/work',
        hook_event_name: 'PreToolUse',
      }),
    );
    io.stdin.end();

    expect(runHookCodex(context, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('invalid hook event payload'))).toBe(true);
    expect(deps.calls).toEqual([]);
  });
});

describe('extractLatestPlanFromTranscript', () => {
  it('extracts the latest plan item from Codex transcript JSONL', () => {
    const transcript = [transcriptWithPlan('# Old'), transcriptWithPlan('# New')].join('\n');

    expect(extractLatestPlanFromTranscript(transcript, 'turn_123')).toBe('# New');
  });

  it('ignores plan items from other Codex turns', () => {
    const transcript = [transcriptWithPlan('# Old', 'turn_old'), transcriptWithPlan('# Current', 'turn_current')].join(
      '\n',
    );

    expect(extractLatestPlanFromTranscript(transcript, 'turn_current')).toBe('# Current');
    expect(extractLatestPlanFromTranscript(transcript, 'turn_missing')).toBe(null);
  });

  it('returns null when the latest current-turn Plan was already followed by a plan-review hook prompt', () => {
    const transcript = [transcriptWithPlan('# Reviewed Plan'), planReviewHookPrompt()].join('\n');

    expect(extractLatestPlanFromTranscript(transcript, 'turn_123')).toBe(null);
  });

  it('extracts a revised current-turn Plan after a plan-review hook prompt', () => {
    const transcript = [
      transcriptWithPlan('# Reviewed Plan'),
      planReviewHookPrompt(),
      transcriptWithPlan('# Revised Plan'),
    ].join('\n');

    expect(extractLatestPlanFromTranscript(transcript, 'turn_123')).toBe('# Revised Plan');
  });
});

interface RecordingHookDependencies extends HookCodexDependencies {
  calls: RunAnnotationArgs[];
  transcriptReadCount: number;
}

function createHookDependencies(
  options: {
    submission?: AnnotationSubmission;
    transcript?: string | Error;
    runReview?: HookCodexDependencies['runReview'];
  } = {},
): RecordingHookDependencies {
  const {
    submission = annotationSubmission.build(),
    transcript = transcriptWithPlan('# Plan\n\nStep 1.\n'),
    runReview,
  } = options;

  const deps: RecordingHookDependencies = {
    calls: [],
    transcriptReadCount: 0,
    readTranscript: () => {
      deps.transcriptReadCount += 1;
      return transcript instanceof Error ? Promise.reject(transcript) : Promise.resolve(transcript);
    },
    runReview:
      runReview ??
      ((_ctx, args) => {
        deps.calls.push(args);
        return Promise.resolve(submission);
      }),
  };
  return deps;
}

function writeStopPayload(
  io: ReturnType<typeof createStubContext>['io'],
  overrides: Partial<CodexStopHookPayload> = {},
): void {
  io.stdin.write(JSON.stringify({ ...codexStopHookPayload.build(), ...overrides }));
  io.stdin.end();
}

function transcriptWithPlan(text: string, turnId = 'turn_123'): string {
  return JSON.stringify(codexTranscriptPlanLine.build({}, { transient: { text, turnId } }));
}

function planReviewHookPrompt(): string {
  return JSON.stringify(codexTranscriptHookPromptLine.build());
}
