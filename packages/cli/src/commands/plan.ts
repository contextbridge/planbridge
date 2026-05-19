import { resolve as resolvePath } from 'node:path';
import { getErrorMessage } from '@contextbridge/shared/errors';
import { type Command, CommanderError, InvalidArgumentError } from 'commander';
import {
  type AnnotationDependencies,
  AnnotationEnvironmentError,
  AnnotationInterruptedError,
  runAnnotation,
} from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { parsePort } from '#src/environment.ts';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { PLAN_TEMPLATES } from '#src/formatters/plan/templates.ts';
import { abort } from './abort.ts';

export interface PlanArgs {
  path?: string;
  port?: number;
}

export async function runPlan(ctx: CliContext, args: PlanArgs, deps?: AnnotationDependencies): Promise<void> {
  const { io, logger } = ctx;
  const { path, port } = args;

  if (!path && io.stdinIsTTY === true) {
    abort(
      ctx,
      'plan',
      'input',
      'provide plan content via stdin (e.g. `cat plan.md | contextbridge plan`) or a file path via [path]',
    );
  }

  const source: 'file' | 'stdin' = path ? 'file' : 'stdin';
  let content: string;
  try {
    content = path ? await Bun.file(path).text() : await io.readStdin();
  } catch (err) {
    abort(ctx, 'plan', 'input', `failed to read plan from ${source}: ${getErrorMessage(err)}`);
  }

  if (content.trim().length === 0) {
    abort(ctx, 'plan', 'input', 'plan content is empty');
  }

  const sourcePath = path ? resolvePath(path) : undefined;

  logger.info({ source, bytes: Buffer.byteLength(content, 'utf8') }, 'plan received');

  try {
    const submission = await runAnnotation(
      ctx,
      { content, contentKind: 'plan', entrypoint: 'plan_command', port, sourcePath },
      deps,
    );
    io.writeStdout(formatAgentResponse(PLAN_TEMPLATES, submission, content));
  } catch (err) {
    if (err instanceof AnnotationInterruptedError) {
      logger.info('plan review interrupted');
      throw new CommanderError(130, 'contextbridge.plan.sigint', 'plan review interrupted');
    }
    if (err instanceof AnnotationEnvironmentError) {
      abort(ctx, 'plan', 'environment', err.message);
    }
    abort(ctx, 'plan', 'runtime', getErrorMessage(err));
  }
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
      await runPlan(ctx, { path, port: opts.port });
    });
}

function parsePortOption(value: string): number {
  try {
    return parsePort(value);
  } catch {
    throw new InvalidArgumentError('port must be an integer between 1 and 65535');
  }
}
