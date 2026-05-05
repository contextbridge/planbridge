import { Writable } from 'node:stream';
import type { Public } from '@contextbridge/shared/types';

export interface RunCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunCommandOptions {
  readonly stdio?: 'pipe' | 'inherit';
}

export interface CommandRunnerImplDeps {
  readonly out?: Writable;
  readonly err?: Writable;
}

export type CommandRunner = Public<CommandRunnerImpl>;

export class CommandRunnerImpl {
  private readonly out: Writable;
  private readonly err: Writable;

  /* eslint-disable no-restricted-properties */
  constructor({ out = process.stdout, err = process.stderr }: CommandRunnerImplDeps = {}) {
    /* eslint-enable no-restricted-properties */
    this.out = out;
    this.err = err;
  }

  which(cmd: string): string | null {
    return Bun.which(cmd);
  }

  async run(cmd: string, args: readonly string[], opts: RunCommandOptions = {}): Promise<RunCommandResult> {
    const { stdio = 'pipe' } = opts;

    const proc = Bun.spawn({
      cmd: [cmd, ...args],
      stdin: stdio === 'inherit' ? 'inherit' : undefined,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      stdio === 'inherit' ? teeStream(proc.stdout, this.out) : new Response(proc.stdout).text(),
      stdio === 'inherit' ? teeStream(proc.stderr, this.err) : new Response(proc.stderr).text(),
      proc.exited,
    ]);

    return { exitCode, stdout, stderr };
  }
}

async function teeStream(source: ReadableStream<Uint8Array>, sink: Writable): Promise<string> {
  const [forSink, forCapture] = source.tee();
  // preventClose: don't propagate end-of-stream to the parent's stdout/stderr.
  const [, captured] = await Promise.all([
    forSink.pipeTo(Writable.toWeb(sink), { preventClose: true }),
    new Response(forCapture).text(),
  ]);
  return captured;
}
