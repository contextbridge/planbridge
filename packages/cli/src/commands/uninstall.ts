import type { Command } from 'commander';
import type { ResultAsync } from 'neverthrow';
import type { CliContext } from '#src/context.ts';
import { ALL_INSTALLERS } from '#src/installers/installers.ts';
import type { AbortError } from './abort.ts';
import { handleCommandResult } from './abort.ts';
import { runHarnessOperation } from './harnessOperation.ts';

export interface UninstallOptions {
  yes?: boolean;
  force?: boolean;
}

export function runUninstall(ctx: CliContext, options: UninstallOptions = {}): ResultAsync<void, AbortError> {
  const { yes = false, force = false } = options;
  return runHarnessOperation(ctx, 'uninstall', { yes, force });
}

export function registerUninstall(ctx: CliContext, program: Command): void {
  const uninstallCommand = program
    .command('uninstall')
    .description(
      'Remove PlanBridge from every detected AI coding harness. Run with no arguments to walk all of them, or pass a harness id to target one.',
    )
    .option('-y, --yes', 'skip confirmation prompts', false)
    .option('--force', 'run uninstall even when PlanBridge is not wired up', false)
    .action(async (opts: UninstallOptions) => {
      await handleCommandResult(ctx, runUninstall(ctx, opts));
    });

  for (const installer of ALL_INSTALLERS) {
    installer.registerUninstall(ctx, uninstallCommand);
  }
}
