import type { Analytics, Telemetry, TelemetryUser } from '../shared/index.ts';

export interface RecordedCapture {
  readonly event: string;
  readonly properties?: Record<string, unknown>;
}

export interface RecordedIdentify {
  readonly distinctId: string;
  readonly properties?: Record<string, unknown>;
}

export interface FakeAnalytics extends Analytics {
  captures: RecordedCapture[];
  identifies: RecordedIdentify[];
  superProperties: Record<string, unknown>;
  flushCount: number;
  shutdownCount: number;
}

export interface FakeTelemetry extends Telemetry {
  exceptions: unknown[];
  user: TelemetryUser | null;
  flushCount: number;
}

export function createFakeAnalytics(): FakeAnalytics {
  const analytics: FakeAnalytics = {
    captures: [],
    identifies: [],
    superProperties: {},
    flushCount: 0,
    shutdownCount: 0,
    identify: (distinctId, properties) => {
      analytics.identifies.push({
        distinctId,
        properties: { ...analytics.superProperties, ...properties },
      });
    },
    capture: (event, properties) => {
      analytics.captures.push({
        event,
        properties: { ...analytics.superProperties, ...properties },
      });
    },
    register: (properties) => {
      Object.assign(analytics.superProperties, properties);
    },
    flush: () => {
      analytics.flushCount += 1;
      return Promise.resolve();
    },
    shutdown: () => {
      analytics.shutdownCount += 1;
      return Promise.resolve();
    },
  };
  return analytics;
}

export function createFakeTelemetry(): FakeTelemetry {
  const telemetry: FakeTelemetry = {
    exceptions: [],
    user: null,
    flushCount: 0,
    setUser: (user) => {
      telemetry.user = user;
    },
    captureException: (err) => {
      telemetry.exceptions.push(err);
    },
    flush: () => {
      telemetry.flushCount += 1;
      return Promise.resolve();
    },
  };
  return telemetry;
}
