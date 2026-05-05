import type { Command } from 'commander';
import type { CliContext } from '#src/context.ts';
import { ALL_INSTALLERS } from '#src/harnesses/installers.ts';
import { runHarnessOperation } from './harnessOperation.ts';

export interface UninstallOptions {
  yes?: boolean;
  force?: boolean;
}

export async function runUninstall(ctx: CliContext, options: UninstallOptions = {}): Promise<void> {
  const { yes = false, force = false } = options;
  await runHarnessOperation(ctx, 'uninstall', { yes, force });
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
      await runUninstall(ctx, opts);
    });

  for (const installer of ALL_INSTALLERS) {
    installer.registerUninstall(ctx, uninstallCommand);
  }
}
