import { getErrorMessage } from '@contextbridge/shared/errors';
import type { PlanReviewSubmission } from '@contextbridge/shared/planReviewSchema';
import { type Command, CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';
import { type ClaudeHookResponse, claudeHookResponse } from '#src/formatters/plan/claudeHookResponse.ts';
import { type RunPlanReviewArgs, runPlanReview } from '#src/planReview/runPlanReview.ts';
import { readStreamToString } from '#src/streams.ts';
import { type ClaudeHookPayload, ClaudeHookPayloadSchema } from './claudeHookSchema.ts';

export interface HookClaudeDependencies {
  runReview?: (ctx: CliContext, args: RunPlanReviewArgs) => Promise<PlanReviewSubmission>;
}

export async function runHookClaude(ctx: CliContext, deps: HookClaudeDependencies = {}): Promise<void> {
  const { io } = ctx;

  const payload = await readAndValidatePayload(ctx);
  const response = await dispatchHookEvent(ctx, payload, deps);

  io.stdout.write(`${JSON.stringify(response)}\n`);
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
  const raw = await readStreamToString(io.stdin);

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
  const { runReview = runPlanReview } = deps;

  if (!payload.tool_input?.plan) {
    abort(ctx, 'input', 'missing tool_input.plan for ExitPlanMode');
  }

  const planContent = payload.tool_input.plan;
  logger.info({ tool: payload.tool_name, bytes: Buffer.byteLength(planContent, 'utf8') }, 'claude hook received');

  let submission: PlanReviewSubmission;
  try {
    submission = await runReview(ctx, { planContent, source: 'hook_claude' });
  } catch (err) {
    abort(ctx, 'runtime', getErrorMessage(err));
  }

  return claudeHookResponse(submission, planContent);
}

function abort(ctx: CliContext, kind: 'input' | 'runtime', message: string): never {
  const { logger } = ctx;
  logger.error(message);
  throw new CommanderError(1, `contextbridge.hookClaude.${kind}Error`, message);
}
