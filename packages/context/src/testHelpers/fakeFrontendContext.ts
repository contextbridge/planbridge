import { createFakeFrontendTelemetry } from '@contextbridge/instrumentation/testHelpers/frontend';
import type { FrontendContext } from '../frontend.ts';
import { fakeBaseContext } from './fakeBaseContext.ts';

export function fakeFrontendContext(overrides: Partial<FrontendContext> = {}): FrontendContext {
  return {
    ...fakeBaseContext(),
    telemetry: createFakeFrontendTelemetry(),
    closeWindow: () => {},
    scheduleTimeout: () => () => {},
    ...overrides,
  };
}
