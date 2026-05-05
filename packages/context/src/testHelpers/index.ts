export { fakeBaseContext } from './fakeBaseContext.ts';
export { fakeFrontendContext } from './fakeFrontendContext.ts';
export { type FakeFetchCall, FakeFetcher } from './FakeFetcher.ts';
export {
  type FakeAnalytics,
  type FakeTelemetry,
  type RecordedCapture,
  type RecordedIdentify,
  createFakeAnalytics,
  createFakeTelemetry,
} from '@contextbridge/instrumentation/testHelpers';
export {
  type FakeFrontendTelemetry,
  createFakeFrontendTelemetry,
} from '@contextbridge/instrumentation/testHelpers/frontend';
