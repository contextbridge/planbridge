import { createFakeAnalytics, createFakeTelemetry } from '@contextbridge/instrumentation/testHelpers';
import pino from 'pino';
import type { BaseContext } from '../base.ts';
import type { Logger } from '../logger.ts';
import { buildInfo } from '../testFactories.ts';
import { FakeFetcher } from './FakeFetcher.ts';

const silentLogger: Logger = pino({ level: 'silent' });

export function fakeBaseContext(overrides: Partial<BaseContext> = {}): BaseContext {
  return {
    buildInfo: buildInfo.build(),
    logger: silentLogger,
    distinctId: 'fake-distinct-id',
    telemetryDisabled: true,
    analytics: createFakeAnalytics(),
    telemetry: createFakeTelemetry(),
    fetcher: new FakeFetcher(),
    ...overrides,
  };
}
