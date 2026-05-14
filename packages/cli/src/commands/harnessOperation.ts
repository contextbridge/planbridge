import { getErrorMessage } from '@contextbridge/shared/errors';
import { CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';
import { detectHarness } from '#src/installers/detect.ts';
import type { HarnessInstaller, HarnessStatus, InstallActionOptions } from '#src/installers/HarnessInstaller.ts';
import { ALL_INSTALLERS } from '#src/installers/installers.ts';
import { PROMPTER_CANCELLED_CODE } from '#src/prompter.ts';
import { formatStatusLine } from './installStatus.ts';

export type HarnessOperationMode = 'install' | 'uninstall';

interface ModeLabels {
  readonly pastTense: string;
  readonly confirmMessage: (displayName: string) => string;
  readonly noHarnessesCode: string;
  readonly noHarnessesHint: string;
  readonly failureCode: string;
  readonly failureMessagePrefix: string;
  readonly logMessage: string;
  readonly skippedNote: string;
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
    skippedNote: 'already installed',
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
    skippedNote: 'not installed',
    run: (installer, ctx, options) => installer.uninstall(ctx, options),
  },
};

export interface HarnessOperationOptions {
  readonly yes: boolean;
  readonly force: boolean;
}

export async function runHarnessOperation(
  ctx: CliContext,
  mode: HarnessOperationMode,
  { yes, force }: HarnessOperationOptions,
): Promise<void> {
  const labels = MODE_LABELS[mode];
  const { io, prompter, logger } = ctx;

  const detected: Array<{ installer: HarnessInstaller; status?: HarnessStatus }> = [];
  const failures: string[] = [];

  for (const installer of ALL_INSTALLERS) {
    const detection = detectHarness(ctx, installer.descriptor);
    if (!detection.binaryOnPath) {
      io.writeStderr(
        `${formatStatusLine({ descriptor: installer.descriptor, detected: false, installed: false, managed: [] })}\n`,
      );
      continue;
    }

    try {
      const status = await installer.status(ctx);
      io.writeStderr(`${formatStatusLine(status)}\n`);
      if (status.detected) {
        detected.push({ installer, status });
      }
    } catch (err) {
      const { displayName, id } = installer.descriptor;
      io.writeStderr(`${formatStatusFailureLine(displayName, err)}\n`);
      if (!(err instanceof CommanderError)) {
        logger.error({ err, harness: id }, 'status failed');
      }
      failures.push(displayName);
      detected.push({ installer });
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
  let skippedCount = 0;

  for (const { installer, status } of detected) {
    const { displayName } = installer.descriptor;
    if (!status) continue;

    const alreadyDone = mode === 'install' ? status.installed : status.managed.length === 0;
    if (!force && alreadyDone) {
      skippedCount += 1;
      continue;
    }

    if (!yes) {
      const proceed = await prompter.confirm({
        message: labels.confirmMessage(displayName),
        default: true,
      });
      if (!proceed) {
        io.writeStderr(`${displayName}: skipped\n`);
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

  const detectedNoun = `detected harness${detected.length === 1 ? '' : 'es'}`;
  const skippedSuffix = skippedCount > 0 ? ` (${skippedCount} ${labels.skippedNote}, skipped)` : '';
  io.writeStderr(`${labels.pastTense} ${completedCount} of ${detected.length} ${detectedNoun}${skippedSuffix}.\n`);

  if (failures.length > 0) {
    throw new CommanderError(1, labels.failureCode, `${labels.failureMessagePrefix}: ${failures.join(', ')}`);
  }
}

function formatStatusFailureLine(displayName: string, err: unknown): string {
  const detail = getErrorMessage(err).trim();
  if (detail.length === 0) return `${displayName}: status unavailable`;
  return `${displayName}: status unavailable (${detail})`;
}
