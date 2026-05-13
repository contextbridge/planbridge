import { PassThrough } from 'node:stream';
import { type Io } from '#src/IoImpl.ts';
import { readStreamToString } from '#src/streams.ts';
import { MemoryStream } from './MemoryStream.ts';

export class FakeIo implements Io {
  readonly stdout: MemoryStream;
  readonly stderr: MemoryStream;
  readonly stdin: PassThrough & { isTTY?: boolean };

  constructor() {
    this.stdout = new MemoryStream();
    this.stderr = new MemoryStream();
    this.stdin = new PassThrough();
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
