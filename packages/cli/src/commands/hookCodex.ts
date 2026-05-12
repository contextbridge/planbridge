import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { getErrorMessage, toError } from '@contextbridge/shared/errors';
import { safeJsonParse } from '@contextbridge/shared/json';
import type { Command } from 'commander';
import { ResultAsync, err, ok, okAsync } from 'neverthrow';
import { type RunAnnotationArgs, runAnnotation } from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { type CodexStopResponse, codexStopResponse } from '#src/formatters/plan/codexStopResponse.ts';
import { AbortError, handleCommandResult } from './abort.ts';
import {
  type CodexStopHookPayload,
  CodexStopHookPayloadSchema,
  CodexTranscriptHookPromptLineSchema,
  CodexTranscriptPlanLineSchema,
} from './codexHookSchema.ts';

export interface HookCodexDependencies {
  runReview?: (ctx: CliContext, args: RunAnnotationArgs) => Promise<AnnotationSubmission>;
  readTranscript?: (path: string) => Promise<string>;
}

const PROPOSED_PLAN_PATTERN = /<proposed_plan>\s*([\s\S]*?)\s*<\/proposed_plan>/gi;
const TRANSCRIPT_TAIL_READ_BYTES = 1024 * 1024;

// Codex Stop hooks must emit JSON on stdout when exiting 0 if they emit anything; plain text is
// invalid per the spec. When we have no continuation to deliver, write `{}` — a valid JSON object
// with none of the recognized action keys (`decision`, `continue`, `reason`), which leaves Codex's
// default Stop behavior intact. See https://developers.openai.com/codex/hooks#stop.
export function runHookCodex(ctx: CliContext, deps: HookCodexDependencies = {}): ResultAsync<void, AbortError> {
  const { io } = ctx;

  return readAndValidatePayload(ctx)
    .andThen((payload) => handleStop(ctx, payload, deps))
    .map((response) => {
      io.writeStdout(`${JSON.stringify(response ?? {})}\n`);
    });
}

export function registerHookCodex(ctx: CliContext, hookCommand: Command): void {
  hookCommand
    .command('codex')
    .description(
      'Adapter for Codex CLI Stop hook — reads event JSON on stdin, reviews the latest proposed plan, and emits a Stop continuation on stdout',
    )
    .action(async () => {
      await handleCommandResult(ctx, runHookCodex(ctx));
    });
}

// Walk newest → oldest and return on the first match. Codex transcripts can grow long; the
// structured Plan item from the current turn is almost always at the tail, so an O(k) reverse
// scan is faster than a full-pass scan in practice.
export function extractLatestPlanFromTranscript(transcript: string, turnId: string): string | null {
  const lines = transcript.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = (lines[i] ?? '').trim();
    const value = safeJsonParse(line).unwrapOr(null);
    if (!value) continue;

    if (isPlanReviewHookPrompt(value)) return null;

    const parsed = CodexTranscriptPlanLineSchema.safeParse(value);
    if (parsed.success && parsed.data.payload.turn_id === turnId) return parsed.data.payload.item.text;
  }
  return null;
}

function readAndValidatePayload(ctx: CliContext): ResultAsync<CodexStopHookPayload, AbortError> {
  const { io } = ctx;
  return ResultAsync.fromPromise(io.readStdin(), (e) => AbortError.runtime('hookCodex', getErrorMessage(e))).andThen(
    (raw) =>
      safeJsonParse(raw)
        .mapErr((e) => AbortError.input('hookCodex', `failed to parse hook event JSON: ${getErrorMessage(e)}`))
        .andThen((value) => {
          const parsed = CodexStopHookPayloadSchema.safeParse(value);
          if (parsed.success) return ok(parsed.data);
          const summary = parsed.error.issues
            .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
            .join('; ');
          return err(AbortError.input('hookCodex', `invalid hook event payload: ${summary}`));
        }),
  );
}

function handleStop(
  ctx: CliContext,
  payload: CodexStopHookPayload,
  deps: HookCodexDependencies,
): ResultAsync<CodexStopResponse | null, AbortError> {
  const { logger } = ctx;
  const { runReview = runAnnotation } = deps;

  if (payload.stop_hook_active) {
    logger.debug({ hook: payload.hook_event_name }, 'codex hook inspecting active Stop continuation');
  }

  return resolvePlanContent(ctx, payload, deps).andThen((planContent) => {
    if (!planContent) {
      logger.debug({ hook: payload.hook_event_name }, 'codex hook found no proposed plan');
      return okAsync(null);
    }

    logger.info({ bytes: Buffer.byteLength(planContent, 'utf8') }, 'codex hook received');

    return ResultAsync.fromPromise(
      runReview(ctx, { content: planContent, contentKind: 'plan', entrypoint: 'hook_codex' }),
      (e) => AbortError.runtime('hookCodex', getErrorMessage(e)),
    ).map((submission: AnnotationSubmission) => codexStopResponse(submission, planContent));
  });
}

function resolvePlanContent(
  ctx: CliContext,
  payload: CodexStopHookPayload,
  deps: HookCodexDependencies,
): ResultAsync<string | null, AbortError> {
  const { logger } = ctx;
  const { readTranscript = readTranscriptFile } = deps;
  const {
    last_assistant_message: lastAssistantMessage,
    stop_hook_active: stopHookActive,
    transcript_path: transcriptPath,
    turn_id: turnId,
  } = payload;

  if (!stopHookActive) {
    const assistantMessagePlan = extractPlanFromAssistantMessage(lastAssistantMessage);
    if (assistantMessagePlan) return okAsync(assistantMessagePlan);
  }

  if (!transcriptPath) return okAsync(null);

  return ResultAsync.fromPromise(readTranscript(transcriptPath), toError)
    .map((transcript) => extractLatestPlanFromTranscript(transcript, turnId))
    .orElse((e) => {
      logger.error({ err: e, transcript_path: transcriptPath }, 'failed to read codex transcript');
      return okAsync(null);
    });
}

function readTranscriptFile(path: string): Promise<string> {
  const file = Bun.file(path);
  const start = Math.max(0, file.size - TRANSCRIPT_TAIL_READ_BYTES);
  return file.slice(start).text();
}

function extractPlanFromAssistantMessage(message: string | null): string | null {
  if (!message) return null;

  const matches = Array.from(message.matchAll(PROPOSED_PLAN_PATTERN));
  const latestMatch = matches.at(-1);
  if (!latestMatch) return null;

  const planContent = latestMatch[1];
  if (!planContent) return null;

  return planContent.trim() || null;
}

function isPlanReviewHookPrompt(value: unknown): boolean {
  const parsed = CodexTranscriptHookPromptLineSchema.safeParse(value);
  if (!parsed.success) return false;

  return parsed.data.payload.content.some(
    (item) => item.text.includes('<hook_prompt') && item.text.includes('# Plan review:'),
  );
}
