import { CommanderError } from 'commander';
import { z } from 'zod';
import type { CliContext } from '#src/context.ts';
import { detectHarness } from './detect.ts';
import { type HarnessStatus, type ManagedEntry } from './HarnessInstaller.ts';
import { getSupportedDescriptor } from './registry.ts';
import { INSTALL_SCOPES, type InstallScope, ScopedHarnessInstaller } from './ScopedHarnessInstaller.ts';
import type { SupportedHarnessDescriptor } from './types.ts';

const PLUGIN_ID = 'planbridge@contextbridge';
const LEGACY_PLUGIN_ID = 'cli@contextbridge';
const MARKETPLACE_SOURCE = 'contextbridge/claude-plugin';
const MARKETPLACE_NAME = 'contextbridge';

const InstalledPluginSchema = z.object({
  id: z.string().trim().nonempty(),
  scope: z.string().trim().nonempty(),
});
const InstalledPluginsSchema = z.array(InstalledPluginSchema);
type InstalledPlugin = z.infer<typeof InstalledPluginSchema>;

const ConfiguredMarketplaceSchema = z.object({
  name: z.string().trim().nonempty(),
});
const ConfiguredMarketplacesSchema = z.array(ConfiguredMarketplaceSchema);
type ConfiguredMarketplace = z.infer<typeof ConfiguredMarketplaceSchema>;

export class ClaudeInstaller extends ScopedHarnessInstaller {
  readonly descriptor: SupportedHarnessDescriptor = getSupportedDescriptor('claude');
  protected readonly binaryMissingCode = 'contextbridge.claudeInstaller.missingClaude';
  protected readonly configDirName = '.claude';
  protected readonly installDescription = 'Install the PlanBridge plugin into Claude Code via the `claude plugin` CLI.';
  protected readonly uninstallDescription =
    'Uninstall the PlanBridge plugin from Claude Code via the `claude plugin` CLI.';

  async status(ctx: CliContext): Promise<HarnessStatus> {
    const { binaryName } = this.descriptor;
    const detection = detectHarness(ctx, this.descriptor);
    if (!detection.binaryOnPath) {
      return { descriptor: this.descriptor, detected: false, installed: false, managed: [] };
    }
    const managed: ManagedEntry[] = [];
    if (await isMarketplaceConfigured(ctx, binaryName)) {
      managed.push({ kind: 'marketplace', identifier: MARKETPLACE_NAME });
    }
    const plugins = await listPlugins(ctx, binaryName);
    const newScopes = filterPluginScopes(plugins, PLUGIN_ID, INSTALL_SCOPES);
    const legacyScopes = filterPluginScopes(plugins, LEGACY_PLUGIN_ID, INSTALL_SCOPES);
    for (const scope of newScopes) {
      managed.push({ kind: 'plugin', identifier: PLUGIN_ID, scope });
    }
    for (const scope of legacyScopes) {
      managed.push({ kind: 'plugin', identifier: LEGACY_PLUGIN_ID, scope });
    }
    return { descriptor: this.descriptor, detected: true, installed: newScopes.length > 0, managed };
  }

  protected async runInstall(ctx: CliContext, scope: InstallScope): Promise<void> {
    const { io } = ctx;
    const { binaryName } = this.descriptor;

    const plugins = await listPlugins(ctx, binaryName);
    const hasCurrentAtScope = hasPluginAtScope(plugins, PLUGIN_ID, scope);
    const hasLegacyAtScope = hasPluginAtScope(plugins, LEGACY_PLUGIN_ID, scope);

    await runPluginCommand(ctx, binaryName, 'marketplace add', [
      'marketplace',
      'add',
      MARKETPLACE_SOURCE,
      '--scope',
      scope,
    ]);
    if (hasCurrentAtScope) {
      await runPluginCommand(ctx, binaryName, 'update', ['update', PLUGIN_ID, '--scope', scope]);
    } else {
      await runPluginCommand(ctx, binaryName, 'install', ['install', PLUGIN_ID, '--scope', scope]);
    }

    if (hasLegacyAtScope) {
      await runPluginCommand(ctx, binaryName, 'uninstall legacy', ['uninstall', LEGACY_PLUGIN_ID, '--scope', scope]);
      io.stderr.write(`PlanBridge plugin renamed from ${LEGACY_PLUGIN_ID} to ${PLUGIN_ID} — migrated automatically.\n`);
    }

    io.stderr.write(`✓ PlanBridge plugin installed for Claude Code (scope: ${scope}).\n`);
    io.stderr.write(`Restart Claude Code for the plugin to load.\n`);
  }

  protected async runUninstall(ctx: CliContext, scope: InstallScope): Promise<void> {
    const { io, logger } = ctx;
    const { binaryName } = this.descriptor;

    const plugins = await listPlugins(ctx, binaryName);

    if (hasPluginAtScope(plugins, PLUGIN_ID, scope)) {
      await runPluginCommand(ctx, binaryName, 'uninstall', ['uninstall', PLUGIN_ID, '--scope', scope]);
    } else {
      logger.info(`${PLUGIN_ID} is not installed at scope ${scope}; skipping plugin uninstall`);
    }

    if (hasPluginAtScope(plugins, LEGACY_PLUGIN_ID, scope)) {
      await runPluginCommand(ctx, binaryName, 'uninstall legacy', ['uninstall', LEGACY_PLUGIN_ID, '--scope', scope]);
    }

    if (await isMarketplaceConfigured(ctx, binaryName)) {
      await runPluginCommand(ctx, binaryName, 'marketplace remove', ['marketplace', 'remove', MARKETPLACE_NAME]);
    } else {
      logger.info(`${MARKETPLACE_NAME} marketplace is not configured; skipping marketplace remove`);
    }

    io.stderr.write(`✓ PlanBridge plugin removed from Claude Code (scope: ${scope}).\n`);
  }
}

function hasPluginAtScope(plugins: readonly InstalledPlugin[], pluginId: string, scope: string): boolean {
  return plugins.some((p) => p.id === pluginId && p.scope === scope);
}

function filterPluginScopes<T extends string>(
  plugins: readonly InstalledPlugin[],
  pluginId: string,
  scopes: readonly T[],
): T[] {
  return scopes.filter((scope) => hasPluginAtScope(plugins, pluginId, scope));
}

async function isMarketplaceConfigured(ctx: CliContext, binaryName: string): Promise<boolean> {
  const marketplaces = await listMarketplaces(ctx, binaryName);
  return marketplaces.some((m) => m.name === MARKETPLACE_NAME);
}

async function listPlugins(ctx: CliContext, binaryName: string): Promise<InstalledPlugin[]> {
  const { commandRunner } = ctx;
  const result = await commandRunner.run(binaryName, ['plugin', 'list', '--json']);
  requireCleanExit(ctx, binaryName, result, 'plugin list');
  return InstalledPluginsSchema.parse(JSON.parse(result.stdout));
}

async function listMarketplaces(ctx: CliContext, binaryName: string): Promise<ConfiguredMarketplace[]> {
  const { commandRunner } = ctx;
  const result = await commandRunner.run(binaryName, ['plugin', 'marketplace', 'list', '--json']);
  requireCleanExit(ctx, binaryName, result, 'plugin marketplace list');
  return ConfiguredMarketplacesSchema.parse(JSON.parse(result.stdout));
}

async function runPluginCommand(
  ctx: CliContext,
  binaryName: string,
  label: string,
  args: readonly string[],
): Promise<void> {
  const { logger, commandRunner } = ctx;
  const result = await commandRunner.run(binaryName, ['plugin', ...args]);

  logger.debug(
    { args, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr },
    `${binaryName} plugin ${label}`,
  );

  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || `${binaryName} plugin ${label} exited ${result.exitCode}`;
    logger.error(detail);
    throw new CommanderError(result.exitCode, 'contextbridge.claudeInstaller.shellFailure', detail);
  }
}

function requireCleanExit(
  ctx: CliContext,
  binaryName: string,
  result: { exitCode: number; stderr: string },
  label: string,
): void {
  if (result.exitCode === 0) return;
  const { logger } = ctx;
  const detail = result.stderr.trim() || `${binaryName} ${label} exited ${result.exitCode}`;
  logger.error(detail);
  throw new CommanderError(result.exitCode, 'contextbridge.claudeInstaller.listFailure', detail);
}
