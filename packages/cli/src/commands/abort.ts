import { CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';

/**
 * Log and throw a CommanderError for a user-recoverable ('input' or 'environment')
 * or runtime failure inside a subcommand handler.
 */
export function abort(
  ctx: CliContext,
  command: string,
  kind: 'input' | 'runtime' | 'environment',
  message: string,
): never {
  const { logger } = ctx;
  // 'input' and 'environment' are user-recoverable — logged at warn so Sentry's
  // pinoIntegration (error/fatal only) doesn't forward them. 'runtime' is a
  // genuine failure.
  if (kind === 'input' || kind === 'environment') {
    logger.warn(message);
  } else {
    logger.error(message);
  }
  throw new CommanderError(1, `contextbridge.${command}.${kind}Error`, message);
}
