import type { Readable, Writable } from 'node:stream';
import type { Public } from '@contextbridge/shared/types';

export type Io = Public<IoImpl>;

export class IoImpl {
  readonly stdout: Writable & { isTTY?: boolean };
  readonly stderr: Writable & { isTTY?: boolean };
  readonly stdin: Readable & { isTTY?: boolean };

  constructor() {
    // This is the one place that's allowed to touch the real process streams —
    // everything downstream receives them through ctx.io.
    /* eslint-disable no-restricted-properties */
    const stdout = process.stdout;
    const stderr = process.stderr;
    const stdin = process.stdin;
    /* eslint-enable no-restricted-properties */

    this.stdout = stdout;
    this.stderr = stderr;
    this.stdin = stdin;
  }
}
