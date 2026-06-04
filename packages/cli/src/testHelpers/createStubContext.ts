import {
  type FakeAnalytics,
  type FakeTelemetry,
  createFakeAnalytics,
  createFakeTelemetry,
  fakeBaseContext,
} from '@contextbridge/context/testHelpers';
import { okAsync } from 'neverthrow';
import pino from 'pino';
import type { CliContext, PlanRevisionService } from '#src/context.ts';
import { environment } from '#src/testFactories.ts';
import { FakeCommandRunner, FakeIo, FakePrompter, FakeUpdater, MemoryStream } from './index.ts';

export interface TestContext {
  context: CliContext;
  io: FakeIo;
  logs: MemoryStream;
  commandRunner: FakeCommandRunner;
  prompter: FakePrompter;
  updater: FakeUpdater;
  planService: PlanRevisionService;
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
  const planService = createFakePlanService();

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
    planService,
    ...overrides,
  };

  return {
    context,
    io,
    logs,
    commandRunner: context.commandRunner instanceof FakeCommandRunner ? context.commandRunner : commandRunner,
    prompter: context.prompter instanceof FakePrompter ? context.prompter : prompter,
    updater: context.updater instanceof FakeUpdater ? context.updater : updater,
    planService: context.planService,
    analytics: context.analytics as FakeAnalytics,
    telemetry: context.telemetry as FakeTelemetry,
  };
}

function createFakePlanService(): PlanRevisionService {
  return {
    createRevision: (args) =>
      okAsync({
        planId: args.planId ?? 'fake-plan-id',
        revisionId: 'fake-revision-id',
        revisionNumber: args.planId ? 2 : 1,
        previousRevisionId: args.planId ? 'fake-previous-revision-id' : null,
      }),
  };
}
