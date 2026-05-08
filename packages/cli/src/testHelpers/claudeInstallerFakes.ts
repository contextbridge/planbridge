import { getDescriptor } from '#src/harnesses/registry.ts';
import type { FakeCommandRunner } from './FakeCommandRunner.ts';

export type PluginFixture = { id: string; scope: string };
export type MarketplaceFixture = { name: string };

export interface ClaudeStateFixture {
  marketplaces?: Array<{ name: string; plugins?: PluginFixture[] }>;
  /**
   * Plugins listed by `claude plugin list --json` that don't belong to any
   * fixture marketplace. The CLI's `plugin list` output is `{ id, scope }` —
   * no marketplace association — so this models tests that exercise code
   * paths reading only the plugin list (e.g. the "already installed"
   * early-return) without needing a corresponding marketplace fixture.
   */
  unmanagedPlugins?: PluginFixture[];
}

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
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'update']).resolves();
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'update']).resolves();
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();
}

/**
 * Stub the two `claude plugin` listing shellouts in one call, encoding which
 * plugins live in which marketplace. Plugins in `marketplaces[i].plugins` and
 * any `unmanagedPlugins` are merged into the `plugin list --json` response;
 * marketplace names go into `plugin marketplace list --json`.
 */
export function stubClaudeState(commandRunner: FakeCommandRunner, state: ClaudeStateFixture): void {
  const { marketplaces = [], unmanagedPlugins = [] } = state;
  const allPlugins = [...marketplaces.flatMap((m) => m.plugins ?? []), ...unmanagedPlugins];
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult(allPlugins));
  commandRunner
    .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
    .resolves(marketplaceListResult(marketplaces.map(({ name }) => ({ name }))));
}
