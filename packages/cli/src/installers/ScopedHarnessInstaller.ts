import { type Command, Option } from 'commander';
import type { CliContext } from '#src/context.ts';
import { IoImpl } from '#src/IoImpl.ts';
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

  async install(ctx: CliContext, options: ScopedInstallActionOptions): Promise<void> {
    const scope = await this.resolveScope(ctx, options, 'install');
    this.requireBinary(ctx, this.binaryMissingCode);
    const { quiet = false } = options;
    const installCtx = quiet ? { ...ctx, io: IoImpl.from(ctx.io, { quiet }) } : ctx;
    await this.runInstall(installCtx, scope);
  }

  async uninstall(ctx: CliContext, options: ScopedInstallActionOptions): Promise<void> {
    const scope = await this.resolveScope(ctx, options, 'uninstall');
    this.requireBinary(ctx, this.binaryMissingCode);
    await this.runUninstall(ctx, scope);
  }

  registerInstall(ctx: CliContext, parent: Command): void {
    parent
      .command(this.descriptor.id)
      .description(this.installDescription)
      .addOption(this.createScopeOption('install'))
      .addOption(new Option('--quiet').hideHelp())
      .action(async (opts: { scope: InstallScope; quiet?: boolean }) => {
        const { quiet = false, scope } = opts;
        await this.install(ctx, { yes: true, quiet, scope });
      });
  }

  registerUninstall(ctx: CliContext, parent: Command): void {
    parent
      .command(this.descriptor.id)
      .description(this.uninstallDescription)
      .addOption(this.createScopeOption('uninstall'))
      .action(async (opts: { scope: InstallScope }) => {
        await this.uninstall(ctx, { yes: true, scope: opts.scope });
      });
  }

  protected abstract runInstall(ctx: CliContext, scope: InstallScope): Promise<void>;
  protected abstract runUninstall(ctx: CliContext, scope: InstallScope): Promise<void>;

  private async resolveScope(
    ctx: CliContext,
    { yes, scope }: ScopedInstallActionOptions,
    verb: 'install' | 'uninstall',
  ): Promise<InstallScope> {
    if (scope) return scope;
    if (yes) return 'user';
    return this.promptForScope(ctx, verb);
  }

  private promptForScope(ctx: CliContext, verb: 'install' | 'uninstall'): Promise<InstallScope> {
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
