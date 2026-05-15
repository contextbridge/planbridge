import { PassThrough } from 'node:stream';
import { BaseIo } from '#src/BaseIo.ts';
import { MemoryStream } from './MemoryStream.ts';

export class FakeIo extends BaseIo {
  declare readonly stdout: MemoryStream;
  declare readonly stderr: MemoryStream;
  declare readonly stdin: PassThrough & { isTTY?: boolean };

  constructor() {
    super({ stdout: new MemoryStream(), stderr: new MemoryStream(), stdin: new PassThrough() });
  }
}
