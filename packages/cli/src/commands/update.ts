import { type Command, CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';

export async function runUpdate(ctx: CliContext): Promise<void> {
  const { io, logger, updater } = ctx;

  const notice = await updater.checkForUpdate({ forceRefresh: true });
  if (!notice) {
    io.stderr.write('contextbridge is up to date.\n');
    return;
  }

  io.stderr.write(`A new version is available: v${notice.latestVersion} (you're on v${notice.currentVersion}).\n`);
  io.stderr.write(`What's new: https://github.com/contextbridge/planbridge/releases/tag/v${notice.latestVersion}\n`);

  const result = await updater.performUpdate();
  switch (result.status) {
    case 'refused':
      io.stderr.write(`${result.message}\n`);
      throw new CommanderError(1, `contextbridge.update.${result.reason}`, result.message);

    case 'recovery-needed':
      logger.warn(result.diagnostics, 'update: could not detect install method');
      io.stderr.write(`${result.message}\n\n`);
      for (const command of result.fallbackCommands) {
        io.stdout.write(`${command}\n`);
      }
      throw new CommanderError(1, `contextbridge.update.${result.reason}`, result.message);

    case 'skipped-already-latest':
      io.stderr.write(`contextbridge is up to date (v${result.currentVersion}).\n`);
      return;

    case 'executed':
      io.stderr.write('✓ update complete.\n');
      return;

    case 'error':
      logger.error({ cause: result.cause }, result.message);
      io.stderr.write(`${result.message}\n`);
      throw new CommanderError(1, 'contextbridge.update.unexpected', result.message);

    default:
      return assertNever(result);
  }
}

export function registerUpdate(ctx: CliContext, program: Command): void {
  program
    .command('update')
    .description(
      'Check for a newer release and re-run the install method that put this binary on your system (Homebrew or the install script).',
    )
    .action(async () => {
      await runUpdate(ctx);
    });
}

function assertNever(value: never): never {
  throw new Error(`unhandled PerformUpdateResult status: ${JSON.stringify(value)}`);
}
