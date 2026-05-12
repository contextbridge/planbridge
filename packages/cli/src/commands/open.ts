import { resolve as resolvePath } from 'node:path';
import { getErrorMessage } from '@contextbridge/shared/errors';
import type { Command } from 'commander';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import {
  type AnnotationDependencies,
  AnnotationInterruptedError,
  runAnnotation,
} from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { DOCUMENT_TEMPLATES } from '#src/formatters/document/templates.ts';
import { AbortError, handleCommandResult } from './abort.ts';

export interface OpenArgs {
  path?: string;
}

export function runOpen(ctx: CliContext, args: OpenArgs, deps?: AnnotationDependencies): ResultAsync<void, AbortError> {
  const { io, logger } = ctx;
  const { path: argPath } = args;

  if (!argPath && io.stdinIsTTY === true) {
    return errAsync(
      AbortError.input(
        'open',
        'provide content via stdin (e.g. `cat doc.md | contextbridge open`) or a file path via [path]',
      ),
    );
  }

  const source: 'file' | 'stdin' = argPath ? 'file' : 'stdin';
  const sourcePath = argPath ? resolvePath(argPath) : undefined;

  return ResultAsync.fromPromise(argPath ? Bun.file(argPath).text() : io.readStdin(), (err) =>
    AbortError.input('open', `failed to read content from ${source}: ${getErrorMessage(err)}`),
  )
    .andThen((content) => {
      if (content.trim().length === 0) return errAsync(AbortError.input('open', 'content is empty'));
      return okAsync(content);
    })
    .andThen((content) => {
      logger.info({ source, bytes: Buffer.byteLength(content, 'utf8') }, 'open received');
      return ResultAsync.fromPromise(
        runAnnotation(ctx, { content, contentKind: 'document', entrypoint: 'open_command', sourcePath }, deps),
        (err) =>
          err instanceof AnnotationInterruptedError
            ? AbortError.cancelled('open', 'open session interrupted', { code: 'contextbridge.open.sigint' })
            : AbortError.runtime('open', getErrorMessage(err)),
      ).map((submission) => {
        io.writeStdout(formatAgentResponse(DOCUMENT_TEMPLATES, submission, content, { sourcePath }));
      });
    });
}

export function registerOpen(ctx: CliContext, program: Command): void {
  program
    .command('open')
    .description(
      "Open a markdown file or piped content in the PlanBridge browser UI for human annotation. Reads from [path] or stdin, opens a local browser UI, and writes the human's feedback to stdout as markdown.",
    )
    .argument('[path]', 'path to a file containing the content to annotate (alternative to stdin)')
    .action(async (path: string | undefined) => {
      await handleCommandResult(ctx, runOpen(ctx, { path }));
    });
}
