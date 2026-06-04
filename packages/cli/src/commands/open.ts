import { resolve as resolvePath } from 'node:path';
import { getErrorMessage } from '@contextbridge/shared/errors';
import { type Command, CommanderError } from 'commander';
import {
  type AnnotationDependencies,
  AnnotationEnvironmentError,
  AnnotationInterruptedError,
  runAnnotation,
} from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { DOCUMENT_TEMPLATES } from '#src/formatters/document/templates.ts';
import { abort } from './abort.ts';

export interface OpenArgs {
  path?: string;
}

export async function runOpen(ctx: CliContext, args: OpenArgs, deps?: AnnotationDependencies): Promise<void> {
  const { io, logger } = ctx;
  const { path: argPath } = args;

  if (!argPath && io.stdinIsTTY === true) {
    abort(
      ctx,
      'open',
      'input',
      'provide content via stdin (e.g. `cat doc.md | contextbridge open`) or a file path via [path]',
    );
  }

  const source: 'file' | 'stdin' = argPath ? 'file' : 'stdin';
  let content: string;
  try {
    content = argPath ? await Bun.file(argPath).text() : await io.readStdin();
  } catch (err) {
    abort(ctx, 'open', 'input', `failed to read content from ${source}: ${getErrorMessage(err)}`);
  }

  if (content.trim().length === 0) {
    abort(ctx, 'open', 'input', 'content is empty');
  }

  const sourcePath = argPath ? resolvePath(argPath) : undefined;

  logger.info({ source, bytes: Buffer.byteLength(content, 'utf8') }, 'open received');

  try {
    const { submission } = await runAnnotation(
      ctx,
      { content, contentKind: 'document', entrypoint: 'open_command', sourcePath },
      deps,
    );
    io.writeStdout(formatAgentResponse(DOCUMENT_TEMPLATES, submission, content, { sourcePath }));
  } catch (err) {
    if (err instanceof AnnotationInterruptedError) {
      logger.info('open session interrupted');
      throw new CommanderError(130, 'contextbridge.open.sigint', 'open session interrupted');
    }
    if (err instanceof AnnotationEnvironmentError) {
      abort(ctx, 'open', 'environment', err.message);
    }
    abort(ctx, 'open', 'runtime', getErrorMessage(err));
  }
}

export function registerOpen(ctx: CliContext, program: Command): void {
  program
    .command('open')
    .description(
      "Open a markdown file or piped content in the PlanBridge browser UI for human annotation. Reads from [path] or stdin, opens a local browser UI, and writes the human's feedback to stdout as markdown.",
    )
    .argument('[path]', 'path to a file containing the content to annotate (alternative to stdin)')
    .action(async (path: string | undefined) => {
      await runOpen(ctx, { path });
    });
}
