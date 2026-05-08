import { getDescriptor } from '#src/harnesses/registry.ts';
import type { FakeCommandRunner } from './FakeCommandRunner.ts';

export type PluginFixture = { id: string; scope: string };
export type MarketplaceFixture = { name: string };

export function pluginListResult(plugins: PluginFixture[]) {
  return { exitCode: 0, stdout: JSON.stringify(plugins), stderr: '' };
}

export function marketplaceListResult(marketplaces: MarketplaceFixture[]) {
  return { exitCode: 0, stdout: JSON.stringify(marketplaces), stderr: '' };
}

const CLAUDE_BINARY = getDescriptor('claude').binaryName;

/**
 * Prime a FakeCommandRunner with the canonical happy-path responses for every
 * `claude plugin` subcommand the installer can fire: claude on PATH, empty
 * plugin/marketplace lists, and all write commands resolve cleanly. Callers
 * register more-specific overrides (failure cases, populated lists, etc.) with
 * the usual `commandRunner.on(...)` after this — last-match-wins makes them
 * take precedence.
 */
export function primeClaudeShellouts(commandRunner: FakeCommandRunner): void {
  commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'update']).resolves();
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();
}

export function stubPluginList(commandRunner: FakeCommandRunner, plugins: PluginFixture[]): void {
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult(plugins));
}

export function stubMarketplaceList(commandRunner: FakeCommandRunner, marketplaces: MarketplaceFixture[]): void {
  commandRunner
    .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
    .resolves(marketplaceListResult(marketplaces));
}
