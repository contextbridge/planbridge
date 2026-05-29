import { createFakeFrontendTelemetry } from '@contextbridge/instrumentation/testHelpers/frontend';
import type { FrontendContext } from '#src/frontend.ts';
import { fakeBaseContext } from './fakeBaseContext.ts';
import { FakeFrontendBrowser } from './FakeFrontendBrowser.ts';

export function fakeFrontendContext(overrides: Partial<FrontendContext> = {}): FrontendContext {
  return {
    ...fakeBaseContext(),
    telemetry: createFakeFrontendTelemetry(),
    browser: new FakeFrontendBrowser(),
    ...overrides,
  };
}
