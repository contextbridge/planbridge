import { CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';
import { detectHarness } from '#src/harnesses/detect.ts';
import type { HarnessInstaller, InstallActionOptions } from '#src/harnesses/HarnessInstaller.ts';
import { ALL_INSTALLERS } from '#src/harnesses/installers.ts';
import { PROMPTER_CANCELLED_CODE } from '#src/prompter.ts';

export type HarnessOperationMode = 'install' | 'uninstall';

interface ModeLabels {
  readonly pastTense: string;
  readonly confirmMessage: (displayName: string) => string;
  readonly noHarnessesCode: string;
  readonly noHarnessesHint: string;
  readonly failureCode: string;
  readonly failureMessagePrefix: string;
  readonly logMessage: string;
  readonly run: (installer: HarnessInstaller, ctx: CliContext, options: InstallActionOptions) => Promise<void>;
}

const MODE_LABELS: Record<HarnessOperationMode, ModeLabels> = {
  install: {
    pastTense: 'Installed',
    confirmMessage: (displayName) => `Install PlanBridge into ${displayName}?`,
    noHarnessesCode: 'contextbridge.install.noHarnesses',
    noHarnessesHint: 'Install one and re-run, or run `contextbridge install <harness>` directly.',
    failureCode: 'contextbridge.install.partialFailure',
    failureMessagePrefix: 'Install failed for',
    logMessage: 'install failed',
    run: (installer, ctx, options) => installer.install(ctx, options),
  },
  uninstall: {
    pastTense: 'Uninstalled',
    confirmMessage: (displayName) => `Remove PlanBridge from ${displayName}?`,
    noHarnessesCode: 'contextbridge.uninstall.noHarnesses',
    noHarnessesHint: 'Run `contextbridge uninstall <harness>` directly to clean up a removed harness.',
    failureCode: 'contextbridge.uninstall.partialFailure',
    failureMessagePrefix: 'Uninstall failed for',
    logMessage: 'uninstall failed',
    run: (installer, ctx, options) => installer.uninstall(ctx, options),
  },
};

export async function runHarnessOperation(
  ctx: CliContext,
  mode: HarnessOperationMode,
  { yes }: { yes: boolean },
): Promise<void> {
  const labels = MODE_LABELS[mode];
  const { io, prompter, logger } = ctx;

  const detected: HarnessInstaller[] = [];

  for (const installer of ALL_INSTALLERS) {
    const { displayName } = installer.descriptor;
    if (detectHarness(ctx, installer.descriptor).binaryOnPath) {
      io.stderr.write(`${displayName}: detected\n`);
      detected.push(installer);
    } else {
      io.stderr.write(`${displayName}: not detected\n`);
    }
  }

  if (detected.length === 0) {
    const supported = ALL_INSTALLERS.map((i) => i.descriptor.displayName).join(', ');
    throw new CommanderError(
      1,
      labels.noHarnessesCode,
      `No supported AI coding harnesses detected. PlanBridge currently supports: ${supported}. ${labels.noHarnessesHint}`,
    );
  }

  let completedCount = 0;
  const failures: string[] = [];

  for (const installer of detected) {
    const { displayName } = installer.descriptor;
    if (!yes) {
      const proceed = await prompter.confirm({
        message: labels.confirmMessage(displayName),
        default: true,
      });
      if (!proceed) {
        io.stderr.write(`${displayName}: skipped\n`);
        continue;
      }
    }

    try {
      await labels.run(installer, ctx, { yes });
      completedCount += 1;
    } catch (err) {
      if (err instanceof CommanderError && err.code === PROMPTER_CANCELLED_CODE) {
        throw err;
      }
      if (!(err instanceof CommanderError)) {
        logger.error({ err, harness: installer.descriptor.id }, labels.logMessage);
      }
      failures.push(displayName);
    }
  }

  io.stderr.write(
    `${labels.pastTense} ${completedCount} of ${detected.length} detected harness${detected.length === 1 ? '' : 'es'}.\n`,
  );

  if (failures.length > 0) {
    throw new CommanderError(1, labels.failureCode, `${labels.failureMessagePrefix}: ${failures.join(', ')}`);
  }
}
