import type { Command } from 'commander';
import type { ResultAsync } from 'neverthrow';
import type { CliContext } from '#src/context.ts';
import type { HarnessStatus } from '#src/installers/HarnessInstaller.ts';
import { ALL_INSTALLERS } from '#src/installers/installers.ts';
import { AbortError, abortable, handleCommandResult } from './abort.ts';

export interface InstallStatusOptions {
  json?: boolean;
}

export function runInstallStatus(ctx: CliContext, options: InstallStatusOptions = {}): ResultAsync<void, AbortError> {
  return abortable('installStatus', runInstallStatusUnsafe(ctx, options));
}

async function runInstallStatusUnsafe(ctx: CliContext, options: InstallStatusOptions): Promise<void> {
  const { json = false } = options;
  const { io } = ctx;

  const statuses = await readStatuses(ctx);
  if (json) {
    io.writeStdout(`${JSON.stringify(statuses, null, 2)}\n`);
    return;
  }

  for (const status of statuses) {
    io.writeStderr(`${formatStatusLine(status)}\n`);
  }
}

export function formatStatusLine(status: HarnessStatus): string {
  const { displayName } = status.descriptor;
  if (!status.detected) return `${displayName}: not detected`;
  if (status.installed) return `${displayName}: PlanBridge installed (${formatManaged(status)})`;
  if (status.managed.length === 0) return `${displayName}: PlanBridge not installed`;
  return `${displayName}: PlanBridge not installed (${formatManaged(status)})`;
}

export function registerInstallStatus(ctx: CliContext, installCommand: Command): void {
  installCommand
    .command('status')
    .description(
      'Report PlanBridge install status for every supported harness (detected, not detected, or installed). Pretty output goes to stderr; use --json for a stdout-safe payload.',
    )
    .option('--json', 'emit machine-readable JSON to stdout', false)
    .action(async (opts: InstallStatusOptions) => {
      await handleCommandResult(ctx, runInstallStatus(ctx, opts));
    });
}

async function readStatuses(ctx: CliContext): Promise<HarnessStatus[]> {
  const statuses: HarnessStatus[] = [];
  for (const installer of ALL_INSTALLERS) {
    const result = await installer.status(ctx);
    if (result.isErr()) throw result.error;
    statuses.push(result.value);
  }
  return statuses;
}

function formatManaged(status: HarnessStatus): string {
  return status.managed
    .map((entry) => {
      const scopeSuffix = entry.scope ? ` @ ${entry.scope}` : '';
      return `${entry.kind} ${entry.identifier}${scopeSuffix}`;
    })
    .join('; ');
}
