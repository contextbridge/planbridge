import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type FakeAnalytics,
  type FakeTelemetry,
  createFakeAnalytics,
  createFakeTelemetry,
  fakeBaseContext,
} from '@contextbridge/context/testHelpers';
import { Temporal } from '@contextbridge/shared/time';
import { type PlanRepository, PlanRepositoryImpl, createDb } from '@contextbridge/storage';
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
  planRepository: PlanRepository;
  updater: FakeUpdater;
  analytics: FakeAnalytics;
  telemetry: FakeTelemetry;
  cleanup: () => void;
}

export function createStubContext(overrides: Partial<CliContext> = {}): TestContext {
  const io = new FakeIo();
  const logs = new MemoryStream();
  const logger = pino({ level: 'trace' }, logs);
  const analytics = createFakeAnalytics();
  const telemetry = createFakeTelemetry();
  const commandRunner = new FakeCommandRunner();
  const prompter = new FakePrompter();
  const planStorageDir = mkdtempSync(join(tmpdir(), 'cb-cli-plans-'));
  const planDbPath = join(planStorageDir, 'db.sqlite');
  const storage = createDb({ dbPath: planDbPath });
  if (storage.isErr()) throw storage.error;
  const planRepository = new PlanRepositoryImpl({
    db: storage.value.db,
    clock: () => Temporal.Instant.from('2026-05-21T00:00:00Z'),
  });
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
    planRepository,
    updater,
    ...overrides,
  };

  const cleanup = (): void => {
    storage.value.close();
    rmSync(planStorageDir, { recursive: true, force: true });
  };

  return {
    context,
    io,
    logs,
    commandRunner: context.commandRunner instanceof FakeCommandRunner ? context.commandRunner : commandRunner,
    prompter: context.prompter instanceof FakePrompter ? context.prompter : prompter,
    planRepository: context.planRepository,
    updater: context.updater instanceof FakeUpdater ? context.updater : updater,
    analytics: context.analytics as FakeAnalytics,
    telemetry: context.telemetry as FakeTelemetry,
    cleanup,
  };
}
