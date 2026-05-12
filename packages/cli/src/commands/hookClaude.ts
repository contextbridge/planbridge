import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { getErrorMessage } from '@contextbridge/shared/errors';
import { safeJsonParse } from '@contextbridge/shared/json';
import type { Command } from 'commander';
import { ResultAsync, err, errAsync, ok } from 'neverthrow';
import { type RunAnnotationArgs, runAnnotation } from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { type ClaudeHookResponse, claudeHookResponse } from '#src/formatters/plan/claudeHookResponse.ts';
import { AbortError, handleCommandResult } from './abort.ts';
import { type ClaudeHookPayload, ClaudeHookPayloadSchema } from './claudeHookSchema.ts';

export interface HookClaudeDependencies {
  runReview?: (ctx: CliContext, args: RunAnnotationArgs) => Promise<AnnotationSubmission>;
}

export function runHookClaude(ctx: CliContext, deps: HookClaudeDependencies = {}): ResultAsync<void, AbortError> {
  const { io } = ctx;

  return readAndValidatePayload(ctx)
    .andThen((payload) => dispatchHookEvent(ctx, payload, deps))
    .map((response) => {
      io.writeStdout(`${JSON.stringify(response)}\n`);
    });
}

export function registerHookClaude(ctx: CliContext, hookCommand: Command): void {
  hookCommand
    .command('claude')
    .description(
      'Adapter for Claude Code PermissionRequest:ExitPlanMode hook — reads event JSON on stdin, emits a hookSpecificOutput envelope on stdout',
    )
    .action(async () => {
      await handleCommandResult(ctx, runHookClaude(ctx));
    });
}

function readAndValidatePayload(ctx: CliContext): ResultAsync<ClaudeHookPayload, AbortError> {
  const { io } = ctx;
  return ResultAsync.fromPromise(io.readStdin(), (e) => AbortError.runtime('hookClaude', getErrorMessage(e)))
    .andThen((raw) =>
      safeJsonParse(raw).mapErr((e) =>
        AbortError.input('hookClaude', `failed to parse hook event JSON: ${getErrorMessage(e)}`),
      ),
    )
    .andThen((parsed) => {
      const result = ClaudeHookPayloadSchema.safeParse(parsed);
      if (result.success) return ok(result.data);
      const summary = result.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      return err(AbortError.input('hookClaude', `invalid hook event payload: ${summary}`));
    });
}

function dispatchHookEvent(
  ctx: CliContext,
  payload: ClaudeHookPayload,
  deps: HookClaudeDependencies,
): ResultAsync<ClaudeHookResponse, AbortError> {
  switch (payload.hook_event_name) {
    case 'PermissionRequest':
      return handlePermissionRequest(ctx, payload, deps);
    default:
      return errAsync(AbortError.input('hookClaude', `unsupported hook_event_name: ${payload.hook_event_name}`));
  }
}

function handlePermissionRequest(
  ctx: CliContext,
  payload: ClaudeHookPayload,
  deps: HookClaudeDependencies,
): ResultAsync<ClaudeHookResponse, AbortError> {
  switch (payload.tool_name) {
    case 'ExitPlanMode':
      return handleExitPlanMode(ctx, payload, deps);
    default:
      return errAsync(
        AbortError.input('hookClaude', `unsupported tool for PermissionRequest: ${payload.tool_name ?? '<missing>'}`),
      );
  }
}

function handleExitPlanMode(
  ctx: CliContext,
  payload: ClaudeHookPayload,
  deps: HookClaudeDependencies,
): ResultAsync<ClaudeHookResponse, AbortError> {
  const { logger } = ctx;
  const { runReview = runAnnotation } = deps;

  if (!payload.tool_input?.plan) {
    return errAsync(AbortError.input('hookClaude', 'missing tool_input.plan for ExitPlanMode'));
  }

  const planContent = payload.tool_input.plan;
  logger.info({ tool: payload.tool_name, bytes: Buffer.byteLength(planContent, 'utf8') }, 'claude hook received');

  return ResultAsync.fromPromise(
    runReview(ctx, { content: planContent, contentKind: 'plan', entrypoint: 'hook_claude' }),
    (e) => AbortError.runtime('hookClaude', getErrorMessage(e)),
  ).map((submission: AnnotationSubmission) => claudeHookResponse(submission, planContent));
}
