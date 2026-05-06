import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { createStubContext, readErrorLogs, readWarnLogs } from '#src/testHelpers/index.ts';
import { runUpdate } from './update.ts';

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
});
