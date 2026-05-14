import type { InstallableHarness } from '@contextbridge/harness';
import { type Command, CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';

export interface HarnessStatus {
  readonly descriptor: InstallableHarness;
  readonly detected: boolean;
  readonly installed: boolean;
  readonly managed: readonly ManagedEntry[];
}

export interface ManagedEntry {
  readonly kind: string;
  readonly identifier: string;
  readonly scope?: string;
}

export interface InstallActionOptions {
  /** When true, skip per-harness prompts and use defaults (e.g. user scope for Claude). */
  readonly yes: boolean;
}

export abstract class HarnessInstaller {
  abstract readonly descriptor: InstallableHarness;
  abstract status(ctx: CliContext): Promise<HarnessStatus>;
  abstract install(ctx: CliContext, options: InstallActionOptions): Promise<void>;
  abstract uninstall(ctx: CliContext, options: InstallActionOptions): Promise<void>;
  abstract registerInstall(ctx: CliContext, parent: Command): void;
  abstract registerUninstall(ctx: CliContext, parent: Command): void;

  protected requireBinary(ctx: CliContext, code: string): void {
    const { commandRunner } = ctx;
    const { binaryName } = this.descriptor;

    if (commandRunner.which(binaryName)) return;

    const message = this.binaryNotFoundMessage();
    throw new CommanderError(1, code, message);
  }

  private binaryNotFoundMessage(): string {
    const { binaryName, displayName, installUrl } = this.descriptor;
    return `The \`${binaryName}\` binary was not found on PATH. Install ${displayName} first: ${installUrl} — then re-run this command.`;
  }
}
