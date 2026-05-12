import { CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';

/**
 * Log and throw a CommanderError for a user-recoverable ('input') or runtime
 * failure inside a subcommand handler.
 */
export function abort(ctx: CliContext, command: string, kind: 'input' | 'runtime', message: string): never {
  const { logger } = ctx;
  // 'input' is user-recoverable — logged at warn so Sentry's pinoIntegration
  // (error/fatal only) doesn't forward it. 'runtime' is a genuine failure.
  if (kind === 'input') {
    logger.warn(message);
  } else {
    logger.error(message);
  }
  throw new CommanderError(1, `contextbridge.${command}.${kind}Error`, message);
}
