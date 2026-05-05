import type { Command } from 'commander';
import type { CliContext } from '#src/context.ts';
import { ALL_INSTALLERS } from '#src/harnesses/installers.ts';
import { runHarnessOperation } from './harnessOperation.ts';
import { registerInstallStatus } from './installStatus.ts';

export interface InstallOptions {
  yes?: boolean;
  force?: boolean;
}

export async function runInstall(ctx: CliContext, options: InstallOptions = {}): Promise<void> {
  const { yes = false, force = false } = options;
  await runHarnessOperation(ctx, 'install', { yes, force });
}

export function registerInstall(ctx: CliContext, program: Command): void {
  const installCommand = program
    .command('install')
    .description(
      'Wire PlanBridge into every detected AI coding harness. Run with no arguments to walk all of them, or pass a harness id to target one.',
    )
    .option('-y, --yes', 'skip confirmation prompts', false)
    .option('--force', 'reinstall even when PlanBridge is already wired up', false)
    .action(async (opts: InstallOptions) => {
      await runInstall(ctx, opts);
    });

  for (const installer of ALL_INSTALLERS) {
    installer.registerInstall(ctx, installCommand);
  }

  registerInstallStatus(ctx, installCommand);
}
