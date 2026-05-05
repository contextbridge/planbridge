#!/usr/bin/env bun
import '@contextbridge/shared/time';
import { reportHarnessDiscovery } from '@contextbridge/instrumentation/node';
import { type Command, CommanderError } from 'commander';
import { createProgram } from '#src/commands/index.ts';
import { type CliContext, createContext } from '#src/context.ts';
import { detectHarnesses } from '#src/harnesses/detect.ts';

export async function runCli(ctx: CliContext, argv: string[]): Promise<number> {
  const { logger, analytics, distinctId, telemetry } = ctx;
  const program = createProgram(ctx);
  analytics.register({ cb_command: resolveCbCommand(program, argv) });
  analytics.identify(distinctId);
  try {
    await program.parseAsync(argv, { from: 'user' });
    return 0;
  } catch (err) {
    if (err instanceof CommanderError) return handleCommanderError(ctx, err);
    logger.error({ err }, 'unhandled CLI error');
    return 1;
  } finally {
    await Promise.allSettled([analytics.flush(), telemetry.flush()]);
  }
}

/**
 * This is really annoying, but we need to remove flags (e.g., plan filenames) and there appear to be no commander utilites
 * to make this easier. Trading off the complexity so we can capture the command.
 */
export function resolveCbCommand(program: Command, argv: string[]): string {
  const walk = (current: Command, [token, ...rest]: string[]): string[] => {
    if (token === undefined || token === '--') return [];
    if (token.startsWith('-')) {
      const eq = token.indexOf('=');
      const flag = eq === -1 ? token : token.slice(0, eq);
      const opt = current.options.find((o) => o.short === flag || o.long === flag);
      const consumesValue =
        (opt?.required || opt?.optional) && eq === -1 && rest[0] !== undefined && !rest[0].startsWith('-');
      return walk(current, consumesValue ? rest.slice(1) : rest);
    }
    const sub = current.commands.find((c) => c.name() === token || c.aliases().includes(token));
    return sub ? [sub.name(), ...walk(sub, rest)] : [];
  };
  return walk(program, argv).join(' ');
}

function handleCommanderError(ctx: CliContext, err: CommanderError): number {
  const { io } = ctx;
  if (shouldPrintCommanderError(err)) {
    io.stderr.write(`${err.message}\n`);
  }
  return err.exitCode;
}

function shouldPrintCommanderError(err: CommanderError): boolean {
  return (
    err.code.startsWith('contextbridge.') &&
    !err.code.startsWith('contextbridge.update.') &&
    err.message.trim().length > 0
  );
}

if (import.meta.main) {
  const ctx = createContext();
  const { analytics, env, logger } = ctx;

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
  });
  process.on('unhandledRejection', (err) => {
    logger.fatal({ err }, 'unhandledRejection');
  });

  const harnessReport = reportHarnessDiscovery(ctx, {
    env,
    getHarnessDetections: () => detectHarnesses(ctx),
  }).catch((err) => {
    logger.debug({ err }, 'harness discovery telemetry failed');
  });
  const exitCode = await runCli(ctx, process.argv.slice(2));
  await harnessReport;
  await analytics.shutdown();
  process.exit(exitCode);
}
