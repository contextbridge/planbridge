import { getErrorMessage } from '@contextbridge/shared/errors';
import { CommanderError } from 'commander';
import { ResultAsync } from 'neverthrow';
import type { CliContext } from '#src/context.ts';

export type AbortKind = 'input' | 'runtime' | 'cancelled';
export type AbortLevel = 'warn' | 'error';

interface AbortErrorOptions {
  readonly code?: string;
  readonly exitCode?: number;
}

export class AbortError extends CommanderError {
  readonly kind: AbortKind;
  readonly level: AbortLevel;

  constructor(command: string, kind: AbortKind, message: string, options: AbortErrorOptions = {}) {
    const { code = `contextbridge.${command}.${kind}Error`, exitCode = kind === 'cancelled' ? 130 : 1 } = options;
    super(exitCode, code, message);
    this.kind = kind;
    this.level = kind === 'runtime' ? 'error' : 'warn';
  }

  static input(command: string, message: string, options?: AbortErrorOptions): AbortError {
    return new AbortError(command, 'input', message, options);
  }

  static runtime(command: string, message: string, options?: AbortErrorOptions): AbortError {
    return new AbortError(command, 'runtime', message, options);
  }

  static cancelled(command: string, message: string, options?: AbortErrorOptions): AbortError {
    return new AbortError(command, 'cancelled', message, options);
  }
}

export function logAbortError(
  ctx: CliContext,
  err: AbortError,
  message = err.message,
  fields: Record<string, unknown> = {},
): void {
  const { logger } = ctx;
  if (Object.keys(fields).length === 0) {
    logger[err.level](message);
    return;
  }
  logger[err.level]({ ...fields, err }, message);
}

export function throwLoggedAbort(ctx: CliContext, err: AbortError): never {
  logAbortError(ctx, err);
  throw err;
}

/**
 * Commander action boundary: business logic returns ResultAsync, but commander
 * still expects thrown CommanderError instances to drive exit codes.
 */
export function handleCommandResult<T>(ctx: CliContext, result: ResultAsync<T, AbortError>): Promise<T> {
  return result.match(
    (value) => value,
    (err) => throwLoggedAbort(ctx, err),
  );
}

export function toAbortError(command: string): (err: unknown) => AbortError {
  return (err) => (err instanceof AbortError ? err : AbortError.runtime(command, getErrorMessage(err)));
}

export function abortable<T>(command: string, promise: Promise<T>): ResultAsync<T, AbortError> {
  return ResultAsync.fromPromise(promise, toAbortError(command));
}
