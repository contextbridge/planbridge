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

export class IoImpl implements Io {
  readonly stdout: Writer;
  readonly stderr: Writer;
  readonly stdin: Reader;

  constructor(streams: Partial<Pick<Io, 'stdout' | 'stderr' | 'stdin'>> = {}) {
    // This is the one place that's allowed to touch the real process streams —
    // everything downstream receives them through ctx.io.
    /* eslint-disable no-restricted-properties */
    const { stdout = process.stdout, stderr = process.stderr, stdin = process.stdin } = streams;
    /* eslint-enable no-restricted-properties */

    this.stdout = stdout;
    this.stderr = stderr;
    this.stdin = stdin;
  }

  get stdinIsTTY(): boolean | undefined {
    return this.stdin.isTTY;
  }

  readStdin(): Promise<string> {
    return readStreamToString(this.stdin);
  }

  writeStdout(chunk: string): void {
    this.stdout.write(chunk);
  }

  writeStderr(chunk: string): void {
    this.stderr.write(chunk);
  }
}
