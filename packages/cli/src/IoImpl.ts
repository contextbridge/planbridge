import { BaseIo, type Io } from './BaseIo.ts';
export type { Io, Reader, Writer } from './BaseIo.ts';

export interface IoImplOptions extends Partial<Pick<Io, 'stdout' | 'stderr' | 'stdin'>> {
  readonly quiet?: boolean;
}

export class IoImpl extends BaseIo {
  constructor(options: IoImplOptions = {}) {
    // This is the one place that's allowed to touch the real process streams —
    // everything downstream receives them through ctx.io.
    /* eslint-disable no-restricted-properties */
    const { quiet = false, stdout = process.stdout, stderr = process.stderr, stdin = process.stdin } = options;
    /* eslint-enable no-restricted-properties */

    super({ quiet, stdout, stderr, stdin });
  }

  static from(io: Io, options: Pick<IoImplOptions, 'quiet'> = {}): IoImpl {
    return new IoImpl({ stdout: io.stdout, stderr: io.stderr, stdin: io.stdin, ...options });
  }
}
