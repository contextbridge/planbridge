import { type Command, Option } from 'commander';
import { ResultAsync, okAsync } from 'neverthrow';
import type { AbortError } from '#src/commands/abort.ts';
import { handleCommandResult } from '#src/commands/abort.ts';
import type { CliContext } from '#src/context.ts';
import { HarnessInstaller, type InstallActionOptions } from './HarnessInstaller.ts';

export type InstallScope = 'user' | 'project';

export const INSTALL_SCOPES = ['user', 'project'] as const satisfies readonly InstallScope[];

export interface ScopedInstallActionOptions extends InstallActionOptions {
  readonly scope?: InstallScope;
}

/** Base class for harnesses that install PlanBridge at user or project scope. */
export abstract class ScopedHarnessInstaller extends HarnessInstaller {
  protected abstract readonly binaryMissingCode: string;
  protected abstract readonly configDirName: string;
  protected abstract readonly installDescription: string;
  protected abstract readonly uninstallDescription: string;

  install(ctx: CliContext, options: ScopedInstallActionOptions): ResultAsync<void, AbortError> {
    return this.resolveScope(ctx, options, 'install')
      .andThen((scope) => this.requireBinary(ctx, this.binaryMissingCode).map(() => scope))
      .andThen((scope) => this.runInstall(ctx, scope));
  }

  uninstall(ctx: CliContext, options: ScopedInstallActionOptions): ResultAsync<void, AbortError> {
    return this.resolveScope(ctx, options, 'uninstall')
      .andThen((scope) => this.requireBinary(ctx, this.binaryMissingCode).map(() => scope))
      .andThen((scope) => this.runUninstall(ctx, scope));
  }

  registerInstall(ctx: CliContext, parent: Command): void {
    parent
      .command(this.descriptor.id)
      .description(this.installDescription)
      .addOption(this.createScopeOption('install'))
      .action(async (opts: { scope: InstallScope }) => {
        await handleCommandResult(ctx, this.install(ctx, { yes: true, scope: opts.scope }));
      });
  }

  registerUninstall(ctx: CliContext, parent: Command): void {
    parent
      .command(this.descriptor.id)
      .description(this.uninstallDescription)
      .addOption(this.createScopeOption('uninstall'))
      .action(async (opts: { scope: InstallScope }) => {
        await handleCommandResult(ctx, this.uninstall(ctx, { yes: true, scope: opts.scope }));
      });
  }

  protected abstract runInstall(ctx: CliContext, scope: InstallScope): ResultAsync<void, AbortError>;
  protected abstract runUninstall(ctx: CliContext, scope: InstallScope): ResultAsync<void, AbortError>;

  private resolveScope(
    ctx: CliContext,
    { yes, scope }: ScopedInstallActionOptions,
    verb: 'install' | 'uninstall',
  ): ResultAsync<InstallScope, AbortError> {
    if (scope) return okAsync(scope);
    if (yes) return okAsync('user' as const);
    return this.promptForScope(ctx, verb);
  }

  private promptForScope(ctx: CliContext, verb: 'install' | 'uninstall'): ResultAsync<InstallScope, AbortError> {
    const { prompter } = ctx;
    const action = verb === 'install' ? 'install into' : 'remove from';
    return prompter.select<InstallScope>({
      message: verb === 'install' ? 'Install scope:' : 'Uninstall scope:',
      choices: [
        { value: 'user', label: 'user', hint: `${action} ~/${this.configDirName} (recommended)` },
        { value: 'project', label: 'project', hint: `${action} ${this.configDirName}/ in the current directory` },
      ],
      default: 'user',
    });
  }

  private createScopeOption(verb: 'install' | 'uninstall'): Option {
    return new Option(
      '-s, --scope <scope>',
      `where to ${verb} (user = ~/${this.configDirName}, project = ${this.configDirName}/ in the current directory)`,
    )
      .choices([...INSTALL_SCOPES])
      .default('user');
  }
}
