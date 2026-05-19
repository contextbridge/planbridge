import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger } from '@contextbridge/context';
import { buildInfo as buildInfoFactory } from '@contextbridge/context/testFactories';
import { FakeFetcher } from '@contextbridge/context/testHelpers';
import { Temporal } from '@contextbridge/shared/time';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import pino from 'pino';
import type { Environment } from '#src/environment.ts';
import { FakeCommandRunner } from '#src/testHelpers/index.ts';
import { UpdaterImpl, type UpdaterImplDeps } from './UpdaterImpl.ts';

const silentLogger: Logger = pino({ level: 'silent' });

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'cb-updater-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('UpdaterImpl.checkForUpdate', () => {
  it('returns null on dev builds', async () => {
    const updater = buildUpdater({ buildInfo: buildInfoFactory.build({ version: '0.0.0-development' }) });
    expect(await updater.checkForUpdate()).toBeNull();
  });

  it('returns null when opt-out env is set', async () => {
    const updater = buildUpdater({ env: { CONTEXTBRIDGE_UPDATE_CHECK_DISABLED: true } });
    expect(await updater.checkForUpdate()).toBeNull();
  });

  it('returns a notice when the latest cask version is strictly greater', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    expect(await updater.checkForUpdate()).toEqual({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      channel: 'stable',
    });
  });

  it('hits the stable cask URL on the stable channel', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    await updater.checkForUpdate();
    expect(fetcher.calls[0]?.input).toBe(
      'https://raw.githubusercontent.com/contextbridge/homebrew-tap/main/Casks/cli.rb',
    );
  });

  it('hits the alpha cask URL on the alpha channel', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0-alpha.2')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.2.0-alpha.1', channel: 'alpha' }),
      fetcher,
    });
    await updater.checkForUpdate();
    expect(fetcher.calls[0]?.input).toBe(
      'https://raw.githubusercontent.com/contextbridge/homebrew-tap/main/Casks/cli@alpha.rb',
    );
  });

  it('returns null when already on the latest', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.2.0', channel: 'stable' }),
      fetcher,
    });
    expect(await updater.checkForUpdate()).toBeNull();
  });

  it('returns null when the latest version is older (ignores downgrades)', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.3.0', channel: 'stable' }),
      fetcher,
    });
    expect(await updater.checkForUpdate()).toBeNull();
  });

  it('returns null on a non-OK fetch response', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response('Not Found', { status: 404 }));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    expect(await updater.checkForUpdate()).toBeNull();
  });

  it('returns null when the cask body has no version line', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response('cask "cli" do\nend'));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    expect(await updater.checkForUpdate()).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Error('network down'));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    expect(await updater.checkForUpdate()).toBeNull();
  });

  it('reads from cache on a warm path without hitting fetch', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.3.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    // First call fills the cache.
    await updater.checkForUpdate();
    expect(fetcher.calls.length).toBe(1);

    // Second call uses cache — no fetch.
    const result = await updater.checkForUpdate();
    expect(fetcher.calls.length).toBe(1);
    expect(result).toEqual({ currentVersion: '0.1.0', latestVersion: '0.3.0', channel: 'stable' });
  });

  it('bypasses cache when forceRefresh is true', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.3.0')), new Response(caskBody('0.3.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    await updater.checkForUpdate();
    await updater.checkForUpdate({ forceRefresh: true });
    expect(fetcher.calls.length).toBe(2);
  });

  it('invalidates cache when the cached channel differs from the current channel', async () => {
    // Pre-seed the cache with an alpha entry (by running an alpha updater once).
    const warmFetcher = new FakeFetcher();
    warmFetcher.script(new Response(caskBody('0.2.0-alpha.1')));
    await buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0-alpha.0', channel: 'alpha' }),
      fetcher: warmFetcher,
    }).checkForUpdate();

    // Now a stable updater must ignore the alpha cache and go to the network.
    const stableFetcher = new FakeFetcher();
    stableFetcher.script(new Response(caskBody('0.2.0')));
    await buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher: stableFetcher,
    }).checkForUpdate();

    expect(stableFetcher.calls.length).toBe(1);
  });

  it('invalidates cache when the entry is older than the TTL', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')), new Response(caskBody('0.2.0')));
    // Seed cache at t=0, then read at t=3h with default 1h TTL.
    let fakeNow = Temporal.Instant.from('2026-01-01T00:00:00Z');
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
      clock: () => fakeNow,
    });
    await updater.checkForUpdate();
    expect(fetcher.calls.length).toBe(1);

    fakeNow = fakeNow.add({ hours: 3 });
    await updater.checkForUpdate();
    expect(fetcher.calls.length).toBe(2);
  });

  it('writes cache entries with 0600 perms', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    await updater.checkForUpdate();
    const stat = statSync(join(tmpRoot, 'contextbridge', 'update-check.json'));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('never throws when the cache file is corrupt', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    // Seed a corrupt JSON file.
    const cachePath = join(tmpRoot, 'contextbridge', 'update-check.json');
    const dir = join(tmpRoot, 'contextbridge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(cachePath, '{ not valid json', { mode: 0o600 });

    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
    });
    // Falls through to fetch and overwrites the corrupt file.
    await updater.checkForUpdate();
    expect(fetcher.calls.length).toBe(1);
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8')) as { latestVersion: string };
    expect(parsed.latestVersion).toBe('0.2.0');
  });
});

describe('UpdaterImpl.performUpdate', () => {
  it('refuses for dev builds (no logger.error)', async () => {
    const updater = buildUpdater({ buildInfo: buildInfoFactory.build({ version: '0.0.0-development' }) });
    const result = await updater.performUpdate();
    expect(result.status).toBe('refused');
    if (result.status === 'refused') expect(result.reason).toBe('dev-build');
  });

  it('refuses on opt-out', async () => {
    const updater = buildUpdater({ env: { CONTEXTBRIDGE_UPDATE_CHECK_DISABLED: true } });
    const result = await updater.performUpdate();
    expect(result.status).toBe('refused');
    if (result.status === 'refused') expect(result.reason).toBe('opt-out');
  });

  it('returns skipped-already-latest when on latest', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.2.0', channel: 'stable' }),
      fetcher,
    });
    const result = await updater.performUpdate();
    expect(result).toEqual({ status: 'skipped-already-latest', currentVersion: '0.2.0' });
  });

  it('returns recovery-needed with full diagnostics for unknown install method', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
      execPath: '/tmp/contextbridge',
      homedir: '/Users/alice',
    });
    const result = await updater.performUpdate();
    expect(result.status).toBe('recovery-needed');
    if (result.status !== 'recovery-needed') return;

    expect(result.reason).toBe('unknown-install-method');
    expect(result.fallbackCommands).toEqual([
      'brew upgrade --cask contextbridge/tap/cli',
      '/bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)"',
    ]);
    expect(result.diagnostics).toMatchObject({
      execPath: '/tmp/contextbridge',
      realPath: '/tmp/contextbridge',
      homedir: '/Users/alice',
    });
    expect(typeof result.diagnostics.platform).toBe('string');
    expect(typeof result.diagnostics.arch).toBe('string');
  });

  it('emits alpha-channel fallback commands when channel is alpha', async () => {
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0-alpha.2')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.2.0-alpha.1', channel: 'alpha' }),
      fetcher,
      execPath: '/tmp/contextbridge',
    });
    const result = await updater.performUpdate();
    if (result.status !== 'recovery-needed') throw new Error(`expected recovery-needed, got ${result.status}`);
    expect(result.fallbackCommands).toEqual([
      'brew upgrade --cask contextbridge/tap/cli@alpha',
      '/bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)" -- --channel alpha',
    ]);
  });

  it.each([
    ['/opt/homebrew/Cellar/contextbridge/0.1.0/bin/contextbridge', 'Apple Silicon brew formula'],
    ['/usr/local/Cellar/contextbridge/0.1.0/bin/contextbridge', 'Intel brew formula'],
    ['/home/linuxbrew/.linuxbrew/Cellar/contextbridge/0.1.0/bin/contextbridge', 'linuxbrew formula'],
    ['/opt/homebrew/Caskroom/cli/0.1.0/contextbridge', 'Apple Silicon brew cask'],
    ['/usr/local/Caskroom/cli/0.1.0/contextbridge', 'Intel brew cask'],
  ])('detects %s as homebrew (%s layout)', async (execPath) => {
    const commandRunner = new FakeCommandRunner();
    commandRunner.onAny().resolves();
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
      execPath,
      commandRunner,
    });
    const result = await updater.performUpdate();
    expect(result.status).toBe('executed');
    expect(commandRunner.calls[0]?.cmd).toBe('brew');
  });

  it('builds the brew argv for homebrew + stable', async () => {
    const commandRunner = new FakeCommandRunner();
    commandRunner.onAny().resolves();
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
      execPath: '/opt/homebrew/Cellar/contextbridge/0.1.0/bin/contextbridge',
      commandRunner,
    });
    const result = await updater.performUpdate();
    expect(result.status).toBe('executed');
    expect(commandRunner.calls).toEqual([
      { cmd: 'brew', args: ['upgrade', '--cask', 'contextbridge/tap/cli'], opts: { stdio: 'inherit' } },
    ]);
  });

  it('builds the brew argv with @alpha cask for homebrew + alpha', async () => {
    const commandRunner = new FakeCommandRunner();
    commandRunner.onAny().resolves();
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.1.0-alpha.2')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0-alpha.1', channel: 'alpha' }),
      fetcher,
      execPath: '/opt/homebrew/Cellar/contextbridge@alpha/0.1.0-alpha.1/bin/contextbridge',
      commandRunner,
    });
    const result = await updater.performUpdate();
    expect(result.status).toBe('executed');
    expect(commandRunner.calls).toEqual([
      { cmd: 'brew', args: ['upgrade', '--cask', 'contextbridge/tap/cli@alpha'], opts: { stdio: 'inherit' } },
    ]);
  });

  it('builds the curl sh -c argv for curl + stable', async () => {
    const commandRunner = new FakeCommandRunner();
    commandRunner.onAny().resolves();
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
      execPath: '/Users/alice/.local/bin/contextbridge',
      homedir: '/Users/alice',
      commandRunner,
    });
    const result = await updater.performUpdate();
    expect(result.status).toBe('executed');
    expect(commandRunner.calls).toEqual([
      {
        cmd: '/bin/sh',
        args: [
          '-c',
          '/bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)" -- --no-brew --no-configure',
        ],
        opts: { stdio: 'inherit' },
      },
    ]);
  });

  it('builds the curl sh -c argv with --channel alpha for curl + alpha', async () => {
    const commandRunner = new FakeCommandRunner();
    commandRunner.onAny().resolves();
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.1.0-alpha.2')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0-alpha.1', channel: 'alpha' }),
      fetcher,
      execPath: '/Users/alice/.local/bin/contextbridge',
      homedir: '/Users/alice',
      commandRunner,
    });
    const result = await updater.performUpdate();
    expect(result.status).toBe('executed');
    expect(commandRunner.calls).toEqual([
      {
        cmd: '/bin/sh',
        args: [
          '-c',
          '/bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)" -- --no-brew --no-configure --channel alpha',
        ],
        opts: { stdio: 'inherit' },
      },
    ]);
  });

  it.each([
    ['stable', '0.1.0', '0.2.0'],
    ['alpha', '0.1.0-alpha.1', '0.1.0-alpha.2'],
  ] as const)(
    'preserves tarball install method on update via --no-brew (curl + %s)',
    async (channel, current, latest) => {
      const commandRunner = new FakeCommandRunner();
      commandRunner.onAny().resolves();
      const fetcher = new FakeFetcher();
      fetcher.script(new Response(caskBody(latest)));
      const updater = buildUpdater({
        buildInfo: buildInfoFactory.build({ version: current, channel }),
        fetcher,
        execPath: '/Users/alice/.local/bin/contextbridge',
        homedir: '/Users/alice',
        commandRunner,
      });
      await updater.performUpdate();
      expect(commandRunner.calls[0]?.args[1]).toContain('--no-brew');
    },
  );

  it.each([
    ['stable', '0.1.0', '0.2.0'],
    ['alpha', '0.1.0-alpha.1', '0.1.0-alpha.2'],
  ] as const)(
    'skips post-install configure on update via --no-configure (curl + %s)',
    async (channel, current, latest) => {
      const commandRunner = new FakeCommandRunner();
      commandRunner.onAny().resolves();
      const fetcher = new FakeFetcher();
      fetcher.script(new Response(caskBody(latest)));
      const updater = buildUpdater({
        buildInfo: buildInfoFactory.build({ version: current, channel }),
        fetcher,
        execPath: '/Users/alice/.local/bin/contextbridge',
        homedir: '/Users/alice',
        commandRunner,
      });
      await updater.performUpdate();
      expect(commandRunner.calls[0]?.args[1]).toContain('--no-configure');
    },
  );

  it('returns { status: error } with the captured stderr in the message on non-zero installer exits', async () => {
    const commandRunner = new FakeCommandRunner();
    commandRunner.onAny().resolves({ exitCode: 17, stderr: 'boom' });
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
      execPath: '/opt/homebrew/Cellar/contextbridge/0.1.0/bin/contextbridge',
      commandRunner,
    });
    const result = await updater.performUpdate();
    expect(result).toEqual({
      status: 'error',
      message: 'installer exited 17: boom',
      cause: expect.objectContaining({
        name: 'InstallerExitError',
        exitCode: 17,
        stderr: 'boom',
      }),
    });
  });

  it('returns { status: error } when the command runner throws', async () => {
    const commandRunner = new FakeCommandRunner(); // no scripted results → throws
    const fetcher = new FakeFetcher();
    fetcher.script(new Response(caskBody('0.2.0')));
    const updater = buildUpdater({
      buildInfo: buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
      fetcher,
      execPath: '/opt/homebrew/Cellar/contextbridge/0.1.0/bin/contextbridge',
      commandRunner,
    });
    const result = await updater.performUpdate();
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.cause).toBeInstanceOf(Error);
  });
});

interface OverrideDeps {
  readonly buildInfo?: UpdaterImplDeps['buildInfo'];
  readonly env?: Partial<Environment>;
  readonly commandRunner?: UpdaterImplDeps['commandRunner'];
  readonly fetcher?: UpdaterImplDeps['fetcher'];
  readonly clock?: UpdaterImplDeps['clock'];
  readonly execPath?: UpdaterImplDeps['execPath'];
  readonly homedir?: UpdaterImplDeps['homedir'];
  readonly logger?: UpdaterImplDeps['logger'];
  readonly ttl?: UpdaterImplDeps['ttl'];
}

function buildUpdater({
  buildInfo = buildInfoFactory.build({ version: '0.1.0', channel: 'stable' }),
  env: envOverrides,
  commandRunner = new FakeCommandRunner(),
  fetcher = emptyFetcher(),
  clock = () => Temporal.Now.instant(),
  execPath = '/Users/alice/.local/bin/contextbridge',
  homedir = '/Users/alice',
  logger = silentLogger,
  ttl,
}: OverrideDeps = {}): UpdaterImpl {
  const env: Environment = {
    LOG_LEVEL: 'info',
    DO_NOT_TRACK: false,
    CONTEXTBRIDGE_TELEMETRY_DISABLED: false,
    CI: false,
    CONTEXTBRIDGE_UPDATE_CHECK_DISABLED: false,
    XDG_CONFIG_HOME: tmpRoot,
    ...envOverrides,
  };
  return new UpdaterImpl({ buildInfo, env, commandRunner, fetcher, clock, execPath, homedir, logger, ttl });
}

function emptyFetcher(): FakeFetcher {
  const fetcher = new FakeFetcher();
  fetcher.script(new Response(caskBody('0.1.0')));
  return fetcher;
}

function caskBody(version: string): string {
  return `cask "cli" do
  version "${version}"
  sha256 "abc"
end`;
}
