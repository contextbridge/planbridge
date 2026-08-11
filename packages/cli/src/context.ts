import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import {
  BUILD_INFO,
  type BaseContext,
  FetcherImpl,
  createBaseContext,
  createLogger,
  isTelemetryDisabled,
} from '@contextbridge/context';
import { createNodeInstrumentation, getOrCreateAnonymousId } from '@contextbridge/instrumentation/node';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import type { SettingsStore } from '@contextbridge/shared/settingsStore';
import { Temporal } from '@contextbridge/shared/time';
import open from 'open';
import { type CommandRunner, CommandRunnerImpl } from '#src/CommandRunnerImpl.ts';
import { type Environment, getEnvironment } from '#src/environment.ts';
import { type Io, IoImpl } from '#src/IoImpl.ts';
import { type Prompter, createClackPrompter } from '#src/prompter.ts';
import { SettingsFileStore } from '#src/settings/SettingsFileStore.ts';
import { type Updater, UpdaterImpl } from '#src/updater/UpdaterImpl.ts';

export interface CliContext extends BaseContext {
  readonly env: Environment;
  readonly projectRoot: string;
  readonly io: Io;
  readonly frontendConfig: Omit<FrontendConfig, 'settings'>;
  readonly settingsStore: SettingsStore;
  readonly openUrl: (url: string) => Promise<void>;
  readonly commandRunner: CommandRunner;
  readonly prompter: Prompter;
  readonly updater: Updater;
}

export function createContext(): CliContext {
  const env = getEnvironment();
  const io = new IoImpl();
  const distinctId = getOrCreateAnonymousId(env);
  const telemetryDisabled = isTelemetryDisabled({ buildInfo: BUILD_INFO, env });

  // Instrument first: Sentry.init + pinoIntegration patch pino globally
  // before the logger is created, so logger.error/fatal auto-forwards.
  const { analytics, telemetry } = createNodeInstrumentation({
    buildInfo: BUILD_INFO,
    distinctId,
    telemetryDisabled,
    surface: 'cli',
  });

  const logger = createLogger({
    level: env.LOG_LEVEL,
    destination: io.stderr,
  });
  const settingsStore = new SettingsFileStore({ env, logger });

  const fetcher = new FetcherImpl();
  const commandRunner = new CommandRunnerImpl({ out: io.stdout, err: io.stderr });
  const prompter = createClackPrompter(io);
  const updater = new UpdaterImpl({
    buildInfo: BUILD_INFO,
    env,
    commandRunner,
    fetcher,
    clock: () => Temporal.Now.instant(),
    execPath: process.execPath,
    logger,
  });

  return {
    ...createBaseContext({ logger, distinctId, telemetryDisabled, analytics, telemetry, fetcher }),
    env,
    projectRoot: resolveProjectRoot(process.cwd()),
    io,
    frontendConfig: { distinctId, telemetryDisabled },
    settingsStore,
    openUrl: defaultOpenUrl,
    commandRunner,
    prompter,
    updater,
  };
}

async function defaultOpenUrl(url: string): Promise<void> {
  await open(url);
}

export function resolveProjectRoot(cwd: string): string {
  const root = parse(cwd).root;
  let current = cwd;

  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    if (current === root) return cwd;
    current = dirname(current);
  }
}
