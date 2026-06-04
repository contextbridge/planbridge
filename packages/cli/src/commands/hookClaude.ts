import { getErrorMessage } from '@contextbridge/shared/errors';
import { type Command, CommanderError } from 'commander';
import { AnnotationEnvironmentError, runAnnotation } from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { type ClaudeHookResponse, claudeHookResponse } from '#src/formatters/plan/claudeHookResponse.ts';
import {
  InvalidPlanIdError,
  type PlanReviewRunner,
  UnknownPlanIdError,
  runPlanReview,
} from '#src/planPersistence/runPlanReview.ts';
import { abort as abortCommand } from './abort.ts';
import { type ClaudeHookPayload, ClaudeHookPayloadSchema } from './claudeHookSchema.ts';

export interface HookClaudeDependencies {
  runReview?: PlanReviewRunner;
}

export async function runHookClaude(ctx: CliContext, deps: HookClaudeDependencies = {}): Promise<void> {
  const { io } = ctx;

  const payload = await readAndValidatePayload(ctx);
  const response = await dispatchHookEvent(ctx, payload, deps);

  io.writeStdout(`${JSON.stringify(response)}\n`);
}

export function registerHookClaude(ctx: CliContext, hookCommand: Command): void {
  hookCommand
    .command('claude')
    .description(
      'Adapter for Claude Code PermissionRequest:ExitPlanMode hook — reads event JSON on stdin, emits a hookSpecificOutput envelope on stdout',
    )
    .action(async () => {
      await runHookClaude(ctx);
    });
}

async function readAndValidatePayload(ctx: CliContext): Promise<ClaudeHookPayload> {
  const { io } = ctx;
  const raw = await io.readStdin();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    abort(ctx, 'input', `failed to parse hook event JSON: ${getErrorMessage(err)}`);
  }

  const result = ClaudeHookPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    abort(ctx, 'input', `invalid hook event payload: ${summary}`);
  }

  return result.data;
}

async function dispatchHookEvent(
  ctx: CliContext,
  payload: ClaudeHookPayload,
  deps: HookClaudeDependencies,
): Promise<ClaudeHookResponse> {
  switch (payload.hook_event_name) {
    case 'PermissionRequest':
      return handlePermissionRequest(ctx, payload, deps);
    default:
      abort(ctx, 'input', `unsupported hook_event_name: ${payload.hook_event_name}`);
  }
}

async function handlePermissionRequest(
  ctx: CliContext,
  payload: ClaudeHookPayload,
  deps: HookClaudeDependencies,
): Promise<ClaudeHookResponse> {
  switch (payload.tool_name) {
    case 'ExitPlanMode':
      return handleExitPlanMode(ctx, payload, deps);
    default:
      abort(ctx, 'input', `unsupported tool for PermissionRequest: ${payload.tool_name ?? '<missing>'}`);
  }
}

async function handleExitPlanMode(
  ctx: CliContext,
  payload: ClaudeHookPayload,
  deps: HookClaudeDependencies,
): Promise<ClaudeHookResponse> {
  const { logger } = ctx;
  const { runReview = runAnnotation } = deps;

  if (!payload.tool_input?.plan) {
    abort(ctx, 'input', 'missing tool_input.plan for ExitPlanMode');
  }

  logger.info(
    { tool: payload.tool_name, bytes: Buffer.byteLength(payload.tool_input.plan, 'utf8') },
    'claude hook received',
  );

  try {
    const result = await runPlanReview(
      ctx,
      {
        content: payload.tool_input.plan,
        entrypoint: 'hook_claude',
      },
      { runReview },
    );
    return claudeHookResponse(result.submission, result.content, { revision: result.revision });
  } catch (err) {
    if (err instanceof AnnotationEnvironmentError) {
      abortCommand(ctx, 'hookClaude', 'environment', err.message);
    }
    if (err instanceof InvalidPlanIdError || err instanceof UnknownPlanIdError) {
      abort(ctx, 'input', err.message);
    }
    abort(ctx, 'runtime', getErrorMessage(err));
  }
}

function abort(ctx: CliContext, kind: 'input' | 'runtime', message: string): never {
  const { logger } = ctx;
  logger.error(message);
  throw new CommanderError(1, `contextbridge.hookClaude.${kind}Error`, message);
}
