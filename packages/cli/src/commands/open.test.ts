import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { annotationSubmission } from '@contextbridge/shared/testFactories';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { formatAgentResponse } from '#src/formatters/annotation/markdown.ts';
import { DOCUMENT_TEMPLATES } from '#src/formatters/document/templates.ts';
import {
  createAnnotationDependencies,
  createDeferred,
  createStubContext,
  readErrorLogs,
  readWarnLogs,
} from '#src/testHelpers/index.ts';
import { runOpen } from './open.ts';

describe('open handler', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cb-open-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('reads content from stdin and emits the formatted submission to stdout', async () => {
    const { context, io } = createStubContext();
    const submission = annotationSubmission.build();
    const deps = createAnnotationDependencies({ submission });
    io.stdin.write('# From stdin\n');
    io.stdin.end();

    await runOpen(context, {}, deps);

    expect(io.stdout.text()).toBe(formatAgentResponse(DOCUMENT_TEMPLATES, submission, deps.payloads[0]!.content));
    expect(deps.payloads[0]?.contentKind).toBe('document');
    expect(deps.payloads[0]?.metadata?.entrypoint).toBe('open_command');
    expect(deps.payloads[0]?.metadata?.sourcePath).toBeUndefined();
  });

  it('reads content from a positional path and includes resolved sourcePath in metadata + stdout', async () => {
    const file = join(tmp, 'doc.md');
    writeFileSync(file, '# A doc\n');

    const { context, io } = createStubContext();
    const submission = annotationSubmission.build();
    const deps = createAnnotationDependencies({ submission });
    io.stdin.isTTY = true;

    await runOpen(context, { path: file }, deps);

    expect(deps.payloads[0]?.metadata?.sourcePath).toBe(resolve(file));
    expect(io.stdout.text()).toBe(
      formatAgentResponse(DOCUMENT_TEMPLATES, submission, deps.payloads[0]!.content, { sourcePath: resolve(file) }),
    );
  });

  it('resolves a relative path to absolute for sourcePath', async () => {
    const file = join(tmp, 'rel.md');
    writeFileSync(file, '# rel\n');

    const { context, io } = createStubContext();
    const deps = createAnnotationDependencies();
    io.stdin.isTTY = true;

    await runOpen(context, { path: file }, deps);
    expect(deps.payloads[0]?.metadata?.sourcePath).toBe(resolve(file));
  });

  it('errors cleanly when neither a path nor piped stdin is supplied', () => {
    const { context, io, logs } = createStubContext();
    io.stdin.isTTY = true;

    expect(runOpen(context, {})).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs).some((r) => r.msg.includes('provide content via stdin'))).toBe(true);
  });

  it('errors cleanly when the file does not exist', () => {
    const { context, io, logs } = createStubContext();
    io.stdin.isTTY = true;

    expect(runOpen(context, { path: join(tmp, 'missing.md') })).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs).some((r) => r.msg.includes('failed to read content from file'))).toBe(true);
  });

  it('errors when content is empty', () => {
    const file = join(tmp, 'empty.md');
    writeFileSync(file, '   \n\n');

    const { context, io, logs } = createStubContext();
    io.stdin.isTTY = true;

    expect(runOpen(context, { path: file })).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(readWarnLogs(logs).some((r) => r.msg.includes('content is empty'))).toBe(true);
  });

  it('closes the server and exits cleanly (without error-level logs) when SIGINT is received', async () => {
    const { context, io, logs } = createStubContext();
    const deps = createAnnotationDependencies({ result: createDeferred<AnnotationSubmission>().promise });
    io.stdin.write('# Open\n');
    io.stdin.end();

    const openPromise = runOpen(context, {}, deps);
    await deps.sigintHandlerRegistered;
    deps.triggerSigint();

    expect(openPromise).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(deps.closed).toBe(true);
    // Interrupt path logs at info level so pinoIntegration doesn't forward it to Sentry.
    expect(readErrorLogs(logs)).toEqual([]);
  });
});
