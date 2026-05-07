import {
  type FakeAnalytics,
  type FakeTelemetry,
  createFakeAnalytics,
  createFakeTelemetry,
  fakeBaseContext,
} from '@contextbridge/context/testHelpers';
import pino from 'pino';
import type { CliContext } from '#src/context.ts';
import { environment } from '#src/testFactories.ts';
import { FakeCommandRunner, FakeIo, FakePrompter, FakeUpdater, MemoryStream } from './index.ts';

export interface TestContext {
  context: CliContext;
  io: FakeIo;
  logs: MemoryStream;
  commandRunner: FakeCommandRunner;
  prompter: FakePrompter;
  updater: FakeUpdater;
  analytics: FakeAnalytics;
  telemetry: FakeTelemetry;
}

export function createStubContext(overrides: Partial<CliContext> = {}): TestContext {
  const io = new FakeIo();
  const logs = new MemoryStream();
  const logger = pino({ level: 'trace' }, logs);
  const analytics = createFakeAnalytics();
  const telemetry = createFakeTelemetry();
  const commandRunner = new FakeCommandRunner();
  const prompter = new FakePrompter();
  const updater = new FakeUpdater();

  const context: CliContext = {
    ...fakeBaseContext({ logger, analytics, telemetry }),
    env: environment.build(),
    projectRoot: '/work',
    io,
    frontendConfig: { distinctId: 'fake-distinct-id', telemetryDisabled: true },
    openUrl: () => Promise.resolve(),
    commandRunner,
    prompter,
    updater,
    scheduleTimeout: () => () => {},
    ...overrides,
  };

  return {
    context,
    io,
    logs,
    commandRunner: context.commandRunner instanceof FakeCommandRunner ? context.commandRunner : commandRunner,
    prompter: context.prompter instanceof FakePrompter ? context.prompter : prompter,
    updater: context.updater instanceof FakeUpdater ? context.updater : updater,
    analytics: context.analytics as FakeAnalytics,
    telemetry: context.telemetry as FakeTelemetry,
  };
}
