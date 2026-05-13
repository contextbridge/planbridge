import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getHarness } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { CLAUDE_LEGACY_PLUGIN_ID, CLAUDE_MARKETPLACE_NAME, CLAUDE_PLUGIN_ID } from '#src/harnesses/ClaudeInstaller.ts';
import {
  createStubContext,
  marketplaceListResult,
  pluginListResult,
  readErrorLogs,
  readWarnLogs,
} from '#src/testHelpers/index.ts';
import { runUpdate } from './update.ts';

const CLAUDE_BINARY = getHarness('claude').binaryName;
const CODEX_BINARY = getHarness('codex').binaryName;
// Arbitrary fake path returned from `commandRunner.which('contextbridge')` so tests
// can stub the refresh-spawn target separately from process.execPath.
const FAKE_CONTEXTBRIDGE_PATH = '/usr/local/bin/contextbridge';

describe('runUpdate', () => {
  it('prints "up to date" and exits 0 when there is no notice', async () => {
    const { context, io } = createStubContext();
    await runUpdate(context);
    expect(io.stderr.text()).toContain('contextbridge is up to date');
  });

  it('refuses on dev-build with no logger.error', () => {
    const { context, io, logs, updater } = createStubContext();
    // Dev-build detection happens inside UpdaterImpl; the FakeUpdater lets
    // us simulate it by returning a notice + refusal.
    updater.setCheckResult({ currentVersion: '0.0.0-development', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'refused',
      reason: 'dev-build',
      message: 'contextbridge is running as a dev build. Rebuild from source to update.',
    });

    expect(runUpdate(context)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stderr.text()).toContain('dev build');
    expect(readErrorLogs(logs)).toEqual([]);
  });

  it('refuses on opt-out with no logger.error', () => {
    const { context, io, logs, updater } = createStubContext();
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'refused',
      reason: 'opt-out',
      message: 'update check is disabled via CONTEXTBRIDGE_UPDATE_CHECK_DISABLED.',
    });

    expect(runUpdate(context)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stderr.text()).toContain('disabled');
    expect(readErrorLogs(logs)).toEqual([]);
  });

  it('emits logger.warn with diagnostics AND prints fallback commands on recovery-needed', () => {
    const { context, io, logs, updater } = createStubContext();
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'recovery-needed',
      reason: 'unknown-install-method',
      message: "contextbridge couldn't detect how the binary at /tmp/contextbridge was installed.",
      fallbackCommands: [
        'brew upgrade --cask contextbridge/tap/cli',
        '/bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)"',
      ],
      diagnostics: {
        execPath: '/tmp/contextbridge',
        realPath: '/tmp/contextbridge',
        platform: 'darwin',
        arch: 'arm64',
        homedir: '/Users/alice',
      },
    });

    expect(runUpdate(context)).rejects.toBeInstanceOf(CommanderError);

    // Both fallback commands printed to stdout so users can pipe/script them.
    expect(io.stdout.text()).toContain('brew upgrade --cask contextbridge/tap/cli');
    expect(io.stdout.text()).toContain('/bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)"');

    const warnLogs = readWarnLogs(logs);
    expect(warnLogs.length).toBe(1);
    expect(warnLogs[0]?.msg).toContain('could not detect install method');
    expect(warnLogs[0]).toMatchObject({
      execPath: '/tmp/contextbridge',
      realPath: '/tmp/contextbridge',
      platform: 'darwin',
      arch: 'arm64',
      homedir: '/Users/alice',
    });
    expect(readErrorLogs(logs)).toEqual([]);
  });

  it('prints alpha-channel fallback commands on recovery-needed for alpha builds', () => {
    const { context, io, updater } = createStubContext();
    updater.setCheckResult({
      currentVersion: '0.2.0-alpha.1',
      latestVersion: '0.2.0-alpha.2',
      channel: 'alpha',
    });
    updater.setPerformResult({
      status: 'recovery-needed',
      reason: 'unknown-install-method',
      message: "contextbridge couldn't detect how the binary at /tmp/contextbridge was installed.",
      fallbackCommands: [
        'brew upgrade --cask contextbridge/tap/cli@alpha',
        '/bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)" -- --channel alpha',
      ],
      diagnostics: {
        execPath: '/tmp/contextbridge',
        realPath: '/tmp/contextbridge',
        platform: 'darwin',
        arch: 'arm64',
        homedir: '/Users/alice',
      },
    });

    expect(runUpdate(context)).rejects.toBeInstanceOf(CommanderError);

    // Alpha variants must appear so users copy the right install command.
    expect(io.stdout.text()).toContain('brew upgrade --cask contextbridge/tap/cli@alpha');
    expect(io.stdout.text()).toContain('--channel alpha');
  });

  it('prints "already on latest" with the current version when skipped-already-latest', async () => {
    const { context, io, updater } = createStubContext();
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({ status: 'skipped-already-latest', currentVersion: '0.2.0' });

    await runUpdate(context);

    expect(io.stderr.text()).toContain('up to date (v0.2.0)');
  });

  it('exits 0 and prints ✓ complete when executed returns exitCode 0', async () => {
    const { context, io, updater } = createStubContext();
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });

    await runUpdate(context);
    expect(io.stderr.text()).toContain('update complete');
  });

  it('prints a changelog URL pointing at the per-version GitHub Release page', async () => {
    const { context, io, updater } = createStubContext();
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });

    await runUpdate(context);

    expect(io.stderr.text()).toContain('https://github.com/contextbridge/planbridge/releases/tag/v0.2.0');
  });

  it('logger.error + throws CommanderError when the installer exits non-zero', () => {
    const { context, io, logs, updater } = createStubContext();
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'error',
      message: 'installer exited 17: brew: command not found',
      cause: new Error('installer exited 17'),
    });

    expect(runUpdate(context)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stderr.text()).toContain('installer exited 17');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('installer exited 17'))).toBe(true);
  });

  it('logger.error + throws on error status', () => {
    const { context, logs, updater } = createStubContext();
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'error',
      message: 'failed to run installer: ECONNRESET',
      cause: new Error('ECONNRESET'),
    });

    expect(runUpdate(context)).rejects.toBeInstanceOf(CommanderError);
    const errorLogs = readErrorLogs(logs);
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0]?.msg).toContain('ECONNRESET');
  });

  it('always bypasses the cache on explicit invocation', async () => {
    const { context, updater } = createStubContext();
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });

    await runUpdate(context);
    expect(updater.checkForUpdateCalls).toEqual([{ forceRefresh: true }]);
    expect(updater.performUpdateCallCount).toBe(1);
  });

  it('refreshes Claude after a successful update when the plugin is wired up', async () => {
    const { context, commandRunner, updater } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.setWhich('contextbridge', FAKE_CONTEXTBRIDGE_PATH);
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));
    commandRunner.on(FAKE_CONTEXTBRIDGE_PATH, ['install', 'claude']).resolves();

    await runUpdate(context);

    const spawnCall = commandRunner.calls.find((c) => c.cmd === FAKE_CONTEXTBRIDGE_PATH);
    expect(spawnCall).toBeDefined();
    expect(spawnCall?.args).toEqual(['install', 'claude', '--scope', 'user']);
  });

  it('refreshes Claude after update when only the legacy cli@contextbridge plugin is installed', async () => {
    const { context, commandRunner, updater } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.setWhich('contextbridge', FAKE_CONTEXTBRIDGE_PATH);
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' }]));
    commandRunner.on(FAKE_CONTEXTBRIDGE_PATH, ['install', 'claude']).resolves();

    await runUpdate(context);

    const spawnCall = commandRunner.calls.find((c) => c.cmd === FAKE_CONTEXTBRIDGE_PATH);
    expect(spawnCall).toBeDefined();
    expect(spawnCall?.args).toEqual(['install', 'claude', '--scope', 'user']);
  });

  it('refreshes Claude at project scope when the new plugin is installed at project scope', async () => {
    const { context, commandRunner, updater } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.setWhich('contextbridge', FAKE_CONTEXTBRIDGE_PATH);
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'project' }]));
    commandRunner.on(FAKE_CONTEXTBRIDGE_PATH, ['install', 'claude']).resolves();

    await runUpdate(context);

    const spawnCall = commandRunner.calls.find((c) => c.cmd === FAKE_CONTEXTBRIDGE_PATH);
    expect(spawnCall).toBeDefined();
    expect(spawnCall?.args).toEqual(['install', 'claude', '--scope', 'project']);
  });

  it('refreshes Claude at project scope when only the legacy plugin is installed at project scope', async () => {
    const { context, commandRunner, updater } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.setWhich('contextbridge', FAKE_CONTEXTBRIDGE_PATH);
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'project' }]));
    commandRunner.on(FAKE_CONTEXTBRIDGE_PATH, ['install', 'claude']).resolves();

    await runUpdate(context);

    const spawnCall = commandRunner.calls.find((c) => c.cmd === FAKE_CONTEXTBRIDGE_PATH);
    expect(spawnCall).toBeDefined();
    expect(spawnCall?.args).toEqual(['install', 'claude', '--scope', 'project']);
  });

  it('refreshes Codex at project scope when the hook is installed at project scope', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-update-codex-project-'));
    const projectRoot = join(tmp, 'repo');
    const { context, commandRunner, updater } = createStubContext({ projectRoot });
    commandRunner.setWhich(CODEX_BINARY, '/usr/local/bin/codex');
    commandRunner.setWhich('contextbridge', FAKE_CONTEXTBRIDGE_PATH);
    commandRunner.on(CODEX_BINARY, ['--version']).resolves({ stdout: 'codex-cli 0.129.0\n' });
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });

    try {
      const configDir = join(projectRoot, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, 'hooks.json'),
        JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'contextbridge hook codex' }] }] } }),
      );
      commandRunner.on(FAKE_CONTEXTBRIDGE_PATH, ['install', 'codex']).resolves();

      await runUpdate(context);

      const spawnCall = commandRunner.calls.find((c) => c.cmd === FAKE_CONTEXTBRIDGE_PATH);
      expect(spawnCall).toBeDefined();
      expect(spawnCall?.args).toEqual(['install', 'codex', '--scope', 'project']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('skips refresh for harnesses with no PlanBridge state after update', async () => {
    const { context, commandRunner, updater } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.setWhich('contextbridge', FAKE_CONTEXTBRIDGE_PATH);
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));

    await runUpdate(context);

    const spawnCalls = commandRunner.calls.filter((c) => c.cmd === FAKE_CONTEXTBRIDGE_PATH);
    expect(spawnCalls).toEqual([]);
  });

  it('skips refresh for Claude marketplace-only state after update', async () => {
    const { context, commandRunner, updater } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.setWhich('contextbridge', FAKE_CONTEXTBRIDGE_PATH);
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));

    await runUpdate(context);

    const spawnCalls = commandRunner.calls.filter((c) => c.cmd === FAKE_CONTEXTBRIDGE_PATH);
    expect(spawnCalls).toEqual([]);
  });

  it('logs an error when post-update refresh exits non-zero but still completes the update', async () => {
    const { context, io, logs, commandRunner, updater } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.setWhich('contextbridge', FAKE_CONTEXTBRIDGE_PATH);
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));
    commandRunner
      .on(FAKE_CONTEXTBRIDGE_PATH, ['install', 'claude'])
      .resolves({ exitCode: 1, stderr: 'install failed' });

    await runUpdate(context);

    expect(io.stderr.text()).toContain('update complete');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('post-update harness refresh failed'))).toBe(true);
  });

  it('logs an error and skips refresh when contextbridge cannot be resolved on PATH', async () => {
    const { context, io, logs, commandRunner, updater } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    // No setWhich for 'contextbridge' — simulates the binary missing from PATH.
    updater.setCheckResult({ currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' });
    updater.setPerformResult({
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge/tap/cli'],
      exitCode: 0,
    });
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));

    await runUpdate(context);

    expect(io.stderr.text()).toContain('update complete');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('contextbridge not found on PATH'))).toBe(true);
    expect(commandRunner.calls.filter((c) => c.cmd === process.execPath)).toEqual([]);
  });
});
