import { type Readable, type Writable } from 'node:stream';
import { readStreamToString } from '#src/streams.ts';

export interface Writer extends Writable {
  readonly isTTY?: boolean;
}

export interface Reader extends Readable {
  readonly isTTY?: boolean;
}

export interface Io {
  /**
   * Raw stdout stream. Prefer `writeStdout(chunk)` — this field exists for
   * library adapters (clack, pino, CommandRunner wiring) and tests that need
   * stream-level access. Handler code should not reach into it.
   */
  readonly stdout: Writer;
  /**
   * Raw stderr stream. Prefer `writeStderr(chunk)` — same rationale as `stdout`.
   */
  readonly stderr: Writer;
  /**
   * Raw stdin stream. Prefer `readStdin()` — same rationale as `stdout`.
   */
  readonly stdin: Reader;
  readonly stdinIsTTY?: boolean;
  readStdin(): Promise<string>;
  writeStdout(chunk: string): void;
  writeStderr(chunk: string): void;
}

export interface BaseIoOptions extends Pick<Io, 'stdout' | 'stderr' | 'stdin'> {
  readonly quiet?: boolean;
}

export abstract class BaseIo implements Io {
  readonly stdout: Writer;
  readonly stderr: Writer;
  readonly stdin: Reader;
  private readonly quiet: boolean;

  protected constructor(options: BaseIoOptions) {
    const { quiet = false, stdout, stderr, stdin } = options;

    this.stdout = stdout;
    this.stderr = stderr;
    this.stdin = stdin;
    this.quiet = quiet;
  }

  get stdinIsTTY(): boolean | undefined {
    return this.stdin.isTTY;
  }

  readStdin(): Promise<string> {
    return readStreamToString(this.stdin);
  }

  writeStdout(chunk: string): void {
    if (this.quiet) return;
    this.stdout.write(chunk);
  }

  writeStderr(chunk: string): void {
    if (this.quiet) return;
    this.stderr.write(chunk);
  }
}
