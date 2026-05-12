import { PassThrough } from 'node:stream';
import { IoImpl } from '#src/IoImpl.ts';
import { MemoryStream } from './MemoryStream.ts';

export class FakeIo extends IoImpl {
  declare readonly stdout: MemoryStream;
  declare readonly stderr: MemoryStream;
  declare readonly stdin: PassThrough & { isTTY?: boolean };

  constructor() {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const stdin = new PassThrough() as PassThrough & { isTTY?: boolean };

    super({ stdout, stderr, stdin });
  }
}
