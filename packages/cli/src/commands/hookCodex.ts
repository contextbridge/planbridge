import { getErrorMessage, toError } from '@contextbridge/shared/errors';
import { safeJsonParse } from '@contextbridge/shared/json';
import { type Command, CommanderError } from 'commander';
import { ResultAsync, err, ok } from 'neverthrow';
import { AnnotationEnvironmentError, runAnnotation } from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { type CodexStopResponse, codexStopResponse } from '#src/formatters/plan/codexStopResponse.ts';
import {
  InvalidPlanIdError,
  type PlanReviewRunner,
  UnknownPlanIdError,
  runPlanReview,
} from '#src/planPersistence/runPlanReview.ts';
import { abort as abortCommand } from './abort.ts';
import {
  type CodexStopHookPayload,
  CodexStopHookPayloadSchema,
  CodexTranscriptHookPromptLineSchema,
  CodexTranscriptPlanLineSchema,
} from './codexHookSchema.ts';

export interface HookCodexDependencies {
  runReview?: PlanReviewRunner;
  readTranscript?: (path: string) => Promise<string>;
}

const PROPOSED_PLAN_PATTERN = /<proposed_plan>\s*([\s\S]*?)\s*<\/proposed_plan>/gi;
const TRANSCRIPT_TAIL_READ_BYTES = 1024 * 1024;

// Codex Stop hooks must emit JSON on stdout when exiting 0 if they emit anything; plain text is
// invalid per the spec. When we have no continuation to deliver, write `{}` — a valid JSON object
// with none of the recognized action keys (`decision`, `continue`, `reason`), which leaves Codex's
// default Stop behavior intact. See https://developers.openai.com/codex/hooks#stop.
export async function runHookCodex(ctx: CliContext, deps: HookCodexDependencies = {}): Promise<void> {
  const { io } = ctx;

  const payload = await readAndValidatePayload(ctx);
  const response = await handleStop(ctx, payload, deps);

  io.writeStdout(`${JSON.stringify(response ?? {})}\n`);
}

export function registerHookCodex(ctx: CliContext, hookCommand: Command): void {
  hookCommand
    .command('codex')
    .description(
      'Adapter for Codex CLI Stop hook — reads event JSON on stdin, reviews the latest proposed plan, and emits a Stop continuation on stdout',
    )
    .action(async () => {
      await runHookCodex(ctx);
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

async function readAndValidatePayload(ctx: CliContext): Promise<CodexStopHookPayload> {
  const { io } = ctx;
  const raw = await io.readStdin();

  return safeJsonParse(raw)
    .mapErr((e) => `failed to parse hook event JSON: ${getErrorMessage(e)}`)
    .andThen((value) => {
      const parsed = CodexStopHookPayloadSchema.safeParse(value);
      if (parsed.success) return ok(parsed.data);
      const summary = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      return err(`invalid hook event payload: ${summary}`);
    })
    .match(
      (data) => data,
      (message) => abort(ctx, 'input', message),
    );
}

async function handleStop(
  ctx: CliContext,
  payload: CodexStopHookPayload,
  deps: HookCodexDependencies,
): Promise<CodexStopResponse | null> {
  const { logger } = ctx;
  const { runReview = runAnnotation } = deps;

  if (payload.stop_hook_active) {
    logger.debug({ hook: payload.hook_event_name }, 'codex hook inspecting active Stop continuation');
  }

  const planContent = await resolvePlanContent(ctx, payload, deps);

  if (!planContent) {
    logger.debug({ hook: payload.hook_event_name }, 'codex hook found no proposed plan');
    return null;
  }

  logger.info({ bytes: Buffer.byteLength(planContent, 'utf8') }, 'codex hook received');

  try {
    const result = await runPlanReview(
      ctx,
      {
        content: planContent,
        entrypoint: 'hook_codex',
      },
      { runReview },
    );
    return codexStopResponse(result.submission, result.content, { revision: result.revision });
  } catch (e) {
    if (e instanceof AnnotationEnvironmentError) {
      abortCommand(ctx, 'hookCodex', 'environment', e.message);
    }
    if (e instanceof InvalidPlanIdError || e instanceof UnknownPlanIdError) {
      abort(ctx, 'input', e.message);
    }
    abort(ctx, 'runtime', getErrorMessage(e));
  }
}

async function resolvePlanContent(
  ctx: CliContext,
  payload: CodexStopHookPayload,
  deps: HookCodexDependencies,
): Promise<string | null> {
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
    if (assistantMessagePlan) return assistantMessagePlan;
  }

  if (!transcriptPath) return null;

  return ResultAsync.fromPromise(readTranscript(transcriptPath), toError)
    .map((transcript) => extractLatestPlanFromTranscript(transcript, turnId))
    .match(
      (plan) => plan,
      (e) => {
        logger.error({ err: e, transcript_path: transcriptPath }, 'failed to read codex transcript');
        return null;
      },
    );
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

function abort(ctx: CliContext, kind: 'input' | 'runtime', message: string): never {
  const { logger } = ctx;
  logger.error(message);
  throw new CommanderError(1, `contextbridge.hookCodex.${kind}Error`, message);
}
