import { getErrorMessage } from '@contextbridge/shared/errors';
import type { ResultAsync as ResultAsyncType } from 'neverthrow';
import type { CliContext } from '#src/context.ts';
import { detectHarness } from '#src/installers/detect.ts';
import type { HarnessInstaller, HarnessStatus, InstallActionOptions } from '#src/installers/HarnessInstaller.ts';
import { ALL_INSTALLERS } from '#src/installers/installers.ts';
import { PROMPTER_CANCELLED_CODE } from '#src/prompter.ts';
import { AbortError, abortable, logAbortError } from './abort.ts';
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
  readonly run: (
    installer: HarnessInstaller,
    ctx: CliContext,
    options: InstallActionOptions,
  ) => ResultAsyncType<void, AbortError>;
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

export function runHarnessOperation(
  ctx: CliContext,
  mode: HarnessOperationMode,
  options: HarnessOperationOptions,
): ResultAsyncType<void, AbortError> {
  return abortable(mode, runHarnessOperationUnsafe(ctx, mode, options));
}

async function runHarnessOperationUnsafe(
  ctx: CliContext,
  mode: HarnessOperationMode,
  { yes, force }: HarnessOperationOptions,
): Promise<void> {
  const labels = MODE_LABELS[mode];
  const { io, prompter } = ctx;

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

    const statusResult = await installer.status(ctx);
    if (statusResult.isOk()) {
      const status = statusResult.value;
      io.writeStderr(`${formatStatusLine(status)}\n`);
      if (status.detected) {
        detected.push({ installer, status });
      }
    } else {
      const err = statusResult.error;
      const { displayName, id } = installer.descriptor;
      io.writeStderr(`${formatStatusFailureLine(displayName, err)}\n`);
      logAbortError(ctx, err, 'status failed', { harness: id });
      failures.push(displayName);
      detected.push({ installer });
    }
  }

  if (detected.length === 0) {
    const supported = ALL_INSTALLERS.map((i) => i.descriptor.displayName).join(', ');
    throw AbortError.input(
      mode,
      `No supported AI coding harnesses detected. PlanBridge currently supports: ${supported}. ${labels.noHarnessesHint}`,
      { code: labels.noHarnessesCode },
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
      const proceedResult = await prompter.confirm({
        message: labels.confirmMessage(displayName),
        default: true,
      });
      if (proceedResult.isErr()) {
        throw proceedResult.error;
      }
      const proceed = proceedResult.value;
      if (!proceed) {
        io.writeStderr(`${displayName}: skipped\n`);
        continue;
      }
    }

    const runResult = await labels.run(installer, ctx, { yes });
    if (runResult.isOk()) {
      completedCount += 1;
    } else {
      const err = runResult.error;
      if (err.code === PROMPTER_CANCELLED_CODE) {
        throw err;
      }
      logAbortError(ctx, err, labels.logMessage, { harness: installer.descriptor.id });
      failures.push(displayName);
    }
  }

  const detectedNoun = `detected harness${detected.length === 1 ? '' : 'es'}`;
  const skippedSuffix = skippedCount > 0 ? ` (${skippedCount} ${labels.skippedNote}, skipped)` : '';
  io.writeStderr(`${labels.pastTense} ${completedCount} of ${detected.length} ${detectedNoun}${skippedSuffix}.\n`);

  if (failures.length > 0) {
    throw AbortError.runtime(mode, `${labels.failureMessagePrefix}: ${failures.join(', ')}`, {
      code: labels.failureCode,
    });
  }
}

function formatStatusFailureLine(displayName: string, err: unknown): string {
  const detail = getErrorMessage(err).trim();
  if (detail.length === 0) return `${displayName}: status unavailable`;
  return `${displayName}: status unavailable (${detail})`;
}
