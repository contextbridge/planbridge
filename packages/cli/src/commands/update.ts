import { GITHUB_REPO_URL } from '@contextbridge/shared/links';
import { type Command, CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';
import type { HarnessInstaller, ManagedEntry } from '#src/installers/HarnessInstaller.ts';
import { ALL_INSTALLERS } from '#src/installers/installers.ts';

export async function runUpdate(ctx: CliContext): Promise<void> {
  const { io, logger, updater } = ctx;

  const notice = await updater.checkForUpdate({ forceRefresh: true });
  if (!notice) {
    io.writeStderr('contextbridge is up to date.\n');
    return;
  }

  io.writeStderr(`A new version is available: v${notice.latestVersion} (you're on v${notice.currentVersion}).\n`);
  io.writeStderr(`What's new: ${GITHUB_REPO_URL}/releases/tag/v${notice.latestVersion}\n`);

  const result = await updater.performUpdate();
  switch (result.status) {
    case 'refused':
      io.writeStderr(`${result.message}\n`);
      throw new CommanderError(1, `contextbridge.update.${result.reason}`, result.message);

    case 'recovery-needed':
      logger.warn(result.diagnostics, 'update: could not detect install method');
      io.writeStderr(`${result.message}\n\n`);
      for (const command of result.fallbackCommands) {
        io.writeStdout(`${command}\n`);
      }
      throw new CommanderError(1, `contextbridge.update.${result.reason}`, result.message);

    case 'skipped-already-latest':
      io.writeStderr(`contextbridge is up to date (v${result.currentVersion}).\n`);
      return;

    case 'executed':
      await refreshInstalledHarnesses(ctx);
      io.writeStderr('✓ update complete.\n');
      return;

    case 'error':
      logger.error({ cause: result.cause }, result.message);
      io.writeStderr(`${result.message}\n`);
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

// After the binary has been swapped, re-run the new binary's per-harness install
// for any harness with existing PlanBridge state. Keeps installed plugins in
// sync with the binary across renames and hook-contract changes. Skips harnesses
// the user never wired up; never blocks update success on a refresh failure.
async function refreshInstalledHarnesses(ctx: CliContext): Promise<void> {
  const { commandRunner, logger } = ctx;
  // Resolve via PATH, not process.execPath: brew purges the old cellar dir before this runs.
  const binaryPath = commandRunner.which('contextbridge');
  if (!binaryPath) {
    logger.error('post-update harness refresh skipped: contextbridge not found on PATH');
    return;
  }
  for (const installer of ALL_INSTALLERS) {
    for (const scope of await getInstallerRefreshScopes(ctx, installer)) {
      await refreshInstallerScope(ctx, binaryPath, installer, scope);
    }
  }
}

async function getInstallerRefreshScopes(ctx: CliContext, installer: HarnessInstaller): Promise<string[]> {
  try {
    const status = await installer.status(ctx);
    return getRefreshScopes(status.managed);
  } catch (err) {
    ctx.logger.error({ err, harness: installer.descriptor.id }, 'post-update harness refresh failed');
    return [];
  }
}

async function refreshInstallerScope(
  ctx: CliContext,
  binaryPath: string,
  installer: HarnessInstaller,
  scope: string,
): Promise<void> {
  const { commandRunner, io, logger } = ctx;
  const harness = installer.descriptor.id;
  try {
    const result = await commandRunner.run(binaryPath, ['install', harness, '--scope', scope, '--quiet'], {
      stdio: 'inherit',
    });
    if (result.exitCode !== 0) {
      logger.error(
        { exitCode: result.exitCode, harness, scope, stdout: result.stdout, stderr: result.stderr },
        'post-update harness refresh failed',
      );
      return;
    }
    io.writeStderr(`✓ refreshed ${installer.descriptor.displayName} (scope: ${scope}).\n`);
  } catch (err) {
    logger.error({ err, harness, scope }, 'post-update harness refresh failed');
  }
}

function getRefreshScopes(managed: readonly ManagedEntry[]): string[] {
  return [
    ...new Set(
      managed.flatMap((entry) => {
        if ((entry.kind !== 'plugin' && entry.kind !== 'hook') || !entry.scope) return [];
        return [entry.scope];
      }),
    ),
  ];
}

function assertNever(value: never): never {
  throw new Error(`unhandled PerformUpdateResult status: ${JSON.stringify(value)}`);
}
