import { PassThrough } from 'node:stream';
import type { Io } from '#src/IoImpl.ts';
import { MemoryStream } from './index.ts';

export class FakeIo implements Io {
  readonly stdout: MemoryStream;
  readonly stderr: MemoryStream;
  readonly stdin: PassThrough & { isTTY?: boolean };

  constructor() {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const stdin = new PassThrough() as PassThrough & { isTTY?: boolean };

    this.stdout = stdout;
    this.stderr = stderr;
    this.stdin = stdin;
  }
}
