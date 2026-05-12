import type { Readable, Writable } from 'node:stream';
import { readStreamToString } from '#src/streams.ts';

export interface Io {
  readonly stdinIsTTY?: boolean;
  readStdin(): Promise<string>;
  writeStdout(chunk: string): void;
  writeStderr(chunk: string): void;
}

type IoStreams = {
  readonly stdout: Writable & Writer;
  readonly stderr: Writable & Writer;
  readonly stdin: Readable & Reader;
};

export interface Writer {
  write(chunk: string): boolean | void;
  readonly isTTY?: boolean;
}

export interface Reader extends AsyncIterable<string | Buffer> {
  readonly isTTY?: boolean;
}

export class IoImpl implements Io, IoStreams {
  readonly stdout: Writable & { isTTY?: boolean };
  readonly stderr: Writable & { isTTY?: boolean };
  readonly stdin: Readable & { isTTY?: boolean };

  constructor(streams: Partial<IoStreams> = {}) {
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
