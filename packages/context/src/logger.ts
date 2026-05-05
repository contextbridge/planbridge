import pino, { type LevelWithSilent, type Logger } from 'pino';
import pinoPretty from 'pino-pretty';

export type { Logger, LevelWithSilent };

export interface NodeLoggerOptions {
  readonly level: LevelWithSilent;
  readonly destination: NodeJS.WritableStream & { isTTY?: boolean };
}

export function createLogger({ level, destination }: NodeLoggerOptions): Logger {
  // pino-pretty runs as a sync stream (not a transport worker) so compiled
  // single-file Bun binaries keep working — transport workers need runtime
  // module resolution that bundled binaries can't satisfy.
  const sink = destination.isTTY
    ? pinoPretty({ colorize: true, destination: destination as NodeJS.WritableStream })
    : destination;
  return pino({ level }, sink);
}
