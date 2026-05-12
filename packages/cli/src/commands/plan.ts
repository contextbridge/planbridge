import { getErrorMessage } from '@contextbridge/shared/errors';
import { type Command, InvalidArgumentError } from 'commander';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import {
  type AnnotationDependencies,
  AnnotationInterruptedError,
  runAnnotation,
} from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { parsePort } from '#src/environment.ts';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { PLAN_TEMPLATES } from '#src/formatters/plan/templates.ts';
import { AbortError, handleCommandResult } from './abort.ts';

export interface PlanArgs {
  path?: string;
  port?: number;
}

export function runPlan(ctx: CliContext, args: PlanArgs, deps?: AnnotationDependencies): ResultAsync<void, AbortError> {
  const { io, logger } = ctx;
  const { path, port } = args;

  if (!path && io.stdinIsTTY === true) {
    return errAsync(
      AbortError.input(
        'plan',
        'provide plan content via stdin (e.g. `cat plan.md | contextbridge plan`) or a file path via [path]',
      ),
    );
  }

  const source: 'file' | 'stdin' = path ? 'file' : 'stdin';
  return ResultAsync.fromPromise(path ? Bun.file(path).text() : io.readStdin(), (err) =>
    AbortError.input('plan', `failed to read plan from ${source}: ${getErrorMessage(err)}`),
  )
    .andThen((content) => {
      if (content.trim().length === 0) return errAsync(AbortError.input('plan', 'plan content is empty'));
      return okAsync(content);
    })
    .andThen((content) => {
      logger.info({ source, bytes: Buffer.byteLength(content, 'utf8') }, 'plan received');
      return ResultAsync.fromPromise(
        runAnnotation(ctx, { content, contentKind: 'plan', entrypoint: 'plan_command', port }, deps),
        (err) =>
          err instanceof AnnotationInterruptedError
            ? AbortError.cancelled('plan', 'plan review interrupted', { code: 'contextbridge.plan.sigint' })
            : AbortError.runtime('plan', getErrorMessage(err)),
      ).map((submission) => {
        io.writeStdout(formatAgentResponse(PLAN_TEMPLATES, submission, content));
      });
    });
}

export function registerPlan(ctx: CliContext, program: Command): void {
  program
    .command('plan')
    .description(
      'Run a PlanBridge plan review: reads the plan from stdin or [path], opens a local browser UI for a human to approve or annotate, and writes the markdown result to stdout.',
    )
    .argument('[path]', 'path to a file containing the plan (alternative to stdin)')
    .option('--port <number>', 'serve the plan review browser UI on a specific port', parsePortOption)
    .action(async (path: string | undefined, opts: { port?: number }) => {
      await handleCommandResult(ctx, runPlan(ctx, { path, port: opts.port }));
    });
}

function parsePortOption(value: string): number {
  try {
    return parsePort(value);
  } catch {
    throw new InvalidArgumentError('port must be an integer between 1 and 65535');
  }
}
