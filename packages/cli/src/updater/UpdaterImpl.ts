import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import { join, sep } from 'node:path';
import type { BuildInfo, Fetcher, Logger } from '@contextbridge/context';
import { getErrorMessage } from '@contextbridge/shared/errors';
import { type Instant, Temporal } from '@contextbridge/shared/time';
import type { Public } from '@contextbridge/shared/types';
import { fromThrowable } from 'neverthrow';
import semver from 'semver';
import type { CommandRunner } from '#src/CommandRunnerImpl.ts';
import type { Environment } from '#src/environment.ts';
import type { Channel, CheckForUpdateOptions, InstallMethod, PerformUpdateResult, UpdateNotice } from './types.ts';

const DEV_BUILD_VERSION = '0.0.0-development';
const DEFAULT_TTL_HOURS = 1;

const APP_DIR_NAME = 'contextbridge';
const CACHE_FILE_NAME = 'update-check.json';
const CASK_BASE = 'https://raw.githubusercontent.com/contextbridge/homebrew-tap/main/Casks';
const FETCH_TIMEOUT_MS = 2_000;
const INSTALL_SH_URL = 'https://downloads.contextbridge.ai/cli/install.sh';
const HOMEBREW_MARKERS = [
  `${sep}Cellar${sep}`,
  `${sep}Caskroom${sep}`,
  `${sep}opt${sep}homebrew${sep}`,
  `${sep}linuxbrew${sep}`,
];

export type Duration = ReturnType<typeof Temporal.Duration.from>;

export interface UpdaterImplDeps {
  readonly buildInfo: BuildInfo;
  readonly env: Environment;
  readonly commandRunner: CommandRunner;
  readonly fetcher: Fetcher;
  readonly clock: () => Instant;
  readonly execPath: string;
  readonly homedir?: string;
  readonly logger: Logger;
  readonly ttl?: Duration;
}

interface CacheEntry {
  readonly checkedAt: string;
  readonly channel: Channel;
  readonly latestVersion: string;
}

export type Updater = Public<UpdaterImpl>;

export class UpdaterImpl {
  private readonly safeReadFile = fromThrowable((path: string) => readFileSync(path, 'utf8'));
  private readonly safeWriteFile = fromThrowable((dir: string, path: string, payload: string) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, payload, { encoding: 'utf8', mode: 0o600 });
  });

  constructor(private readonly deps: UpdaterImplDeps) {}

  async checkForUpdate(options: CheckForUpdateOptions = {}): Promise<UpdateNotice | null> {
    const { buildInfo, env, clock, logger, ttl = Temporal.Duration.from({ hours: DEFAULT_TTL_HOURS }) } = this.deps;
    const { forceRefresh = false } = options;

    if (buildInfo.version === DEV_BUILD_VERSION) return null;
    if (env.CONTEXTBRIDGE_UPDATE_CHECK_DISABLED) return null;

    const now = clock();

    if (!forceRefresh) {
      const cached = this.readCache(buildInfo.channel, now, ttl);
      if (cached) {
        return buildNoticeIfNewer(buildInfo.version, cached, buildInfo.channel);
      }
    }

    const latest = await this.resolveLatestVersion(buildInfo.channel);
    if (!latest) {
      logger.debug({ channel: buildInfo.channel }, 'updater: failed to resolve latest version');
      return null;
    }

    this.writeCache({ checkedAt: now.toString(), channel: buildInfo.channel, latestVersion: latest });
    return buildNoticeIfNewer(buildInfo.version, latest, buildInfo.channel);
  }

  async performUpdate(): Promise<PerformUpdateResult> {
    const { buildInfo, env, commandRunner, execPath, homedir = osHomedir() } = this.deps;

    if (buildInfo.version === DEV_BUILD_VERSION) {
      return {
        status: 'refused',
        reason: 'dev-build',
        message: 'contextbridge is running as a dev build (version 0.0.0-development). Rebuild from source to update.',
      };
    }

    if (env.CONTEXTBRIDGE_UPDATE_CHECK_DISABLED) {
      return {
        status: 'refused',
        reason: 'opt-out',
        message:
          'update check is disabled via CONTEXTBRIDGE_UPDATE_CHECK_DISABLED. Unset it to run contextbridge update.',
      };
    }

    const notice = await this.checkForUpdate();
    if (!notice) {
      return { status: 'skipped-already-latest', currentVersion: buildInfo.version };
    }

    const realPath = resolveRealPath(execPath);
    const method = detectInstallMethod(realPath, homedir);

    if (method === 'unknown') {
      return {
        status: 'recovery-needed',
        reason: 'unknown-install-method',
        message:
          `contextbridge couldn't detect how the binary at ${realPath} was installed. ` +
          `Run one of the commands below to upgrade manually, or reinstall into a supported location.`,
        fallbackCommands: buildFallbackCommands(buildInfo.channel),
        diagnostics: {
          execPath,
          realPath,
          platform: process.platform,
          arch: process.arch,
          homedir,
        },
      };
    }

    const command = buildUpdateCommand(method, buildInfo.channel);

    try {
      const [bin, ...rest] = command;
      if (!bin) throw new Error('buildUpdateCommand returned an empty argv');
      const result = await commandRunner.run(bin, rest, { stdio: 'inherit' });
      if (result.exitCode !== 0) {
        const detail = result.stderr.trim();
        const message = detail
          ? `installer exited ${result.exitCode}: ${detail}`
          : `installer exited ${result.exitCode}`;
        return { status: 'error', message, cause: new InstallerExitError(result.exitCode, result.stderr) };
      }
      return { status: 'executed', command, exitCode: result.exitCode };
    } catch (cause) {
      return {
        status: 'error',
        message: `failed to run installer: ${getErrorMessage(cause)}`,
        cause,
      };
    }
  }

  private async resolveLatestVersion(channel: Channel): Promise<string | null> {
    const url = channel === 'alpha' ? `${CASK_BASE}/cli@alpha.rb` : `${CASK_BASE}/cli.rb`;
    try {
      const response = await this.deps.fetcher.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) return null;
      const body = await response.text();
      const match = /^\s*version\s+"([^"]+)"/m.exec(body);
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  }

  private cacheDir(): string {
    const { env } = this.deps;
    if (env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.length > 0) {
      return join(env.XDG_CONFIG_HOME, APP_DIR_NAME);
    }
    const home = env.HOME && env.HOME.length > 0 ? env.HOME : osHomedir();
    return join(home, '.config', APP_DIR_NAME);
  }

  private cachePath(): string {
    return join(this.cacheDir(), CACHE_FILE_NAME);
  }

  private readCache(channel: Channel, now: Instant, ttl: Duration): string | null {
    const contents = this.safeReadFile(this.cachePath()).unwrapOr('');
    if (contents.length === 0) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      return null;
    }

    if (!isCacheEntry(parsed)) return null;
    if (parsed.channel !== channel) return null;

    let checkedAt: Instant;
    try {
      checkedAt = Temporal.Instant.from(parsed.checkedAt);
    } catch {
      return null;
    }

    const age = now.since(checkedAt);
    if (Temporal.Duration.compare(age, ttl) > 0) return null;

    return parsed.latestVersion;
  }

  private writeCache(entry: CacheEntry): void {
    this.safeWriteFile(this.cacheDir(), this.cachePath(), `${JSON.stringify(entry)}\n`);
  }
}

function resolveRealPath(execPath: string): string {
  try {
    return realpathSync(execPath);
  } catch {
    return execPath;
  }
}

function detectInstallMethod(realPath: string, homedir: string): InstallMethod {
  if (HOMEBREW_MARKERS.some((marker) => realPath.includes(marker))) return 'homebrew';
  if (realPath === join(homedir, '.local', 'bin', 'contextbridge')) return 'curl';
  return 'unknown';
}

function buildUpdateCommand(method: Exclude<InstallMethod, 'unknown'>, channel: Channel): readonly string[] {
  if (method === 'homebrew') {
    const cask = channel === 'alpha' ? 'contextbridge/tap/cli@alpha' : 'contextbridge/tap/cli';
    return ['brew', 'upgrade', '--cask', cask];
  }
  // --no-brew pins install.sh to the tarball path so a tarball-installed user
  // with brew on PATH isn't silently switched to a brew cask. --no-configure
  // avoids re-running the post-install `contextbridge install` step on update.
  const args = ['--no-brew', '--no-configure'];
  if (channel === 'alpha') args.push('--channel', 'alpha');
  return ['/bin/sh', '-c', buildInstallShCommand(args)];
}

function buildFallbackCommands(channel: Channel): readonly string[] {
  // Recovery hints: a user in unknown-install-method state wants the same
  // commands a fresh install would suggest, not the update-specific flags.
  const args = channel === 'alpha' ? ['--channel', 'alpha'] : [];
  return [renderCommand(buildUpdateCommand('homebrew', channel)), buildInstallShCommand(args)];
}

function buildInstallShCommand(args: readonly string[] = []): string {
  const command = `/bin/sh -c "$(curl -fsSL ${INSTALL_SH_URL})"`;
  if (args.length === 0) return command;
  return `${command} -- ${args.join(' ')}`;
}

function renderCommand(command: readonly string[]): string {
  const [head, ...rest] = command;
  if (!head) return '';
  if ((head === 'sh' || head === '/bin/sh') && rest[0] === '-c' && typeof rest[1] === 'string') {
    return rest[1];
  }
  return [head, ...rest].join(' ');
}

function buildNoticeIfNewer(currentVersion: string, latestVersion: string, channel: Channel): UpdateNotice | null {
  if (!semver.valid(currentVersion) || !semver.valid(latestVersion)) return null;
  if (!semver.gt(latestVersion, currentVersion)) return null;
  return { currentVersion, latestVersion, channel };
}

class InstallerExitError extends Error {
  constructor(
    readonly exitCode: number,
    readonly stderr: string,
  ) {
    super(`installer exited ${exitCode}`);
    this.name = 'InstallerExitError';
  }
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['checkedAt'] === 'string' &&
    (v['channel'] === 'stable' || v['channel'] === 'alpha') &&
    typeof v['latestVersion'] === 'string'
  );
}
