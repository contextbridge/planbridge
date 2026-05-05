import { describe, expect, it } from 'bun:test';
import { createNoopAnalytics, createNoopTelemetry } from './index.ts';

describe('createNoopAnalytics', () => {
  it('returns a no-op Analytics client', async () => {
    const analytics = createNoopAnalytics();
    expect(() => analytics.identify('user-1', { plan: 'pro' })).not.toThrow();
    expect(() => analytics.capture('event', { foo: 'bar' })).not.toThrow();
    expect(() => analytics.register({ cb_command: 'plan' })).not.toThrow();
    expect(await analytics.flush()).toBeUndefined();
    expect(await analytics.shutdown()).toBeUndefined();
  });
});

describe('createNoopTelemetry', () => {
  it('returns a no-op Telemetry client', async () => {
    const telemetry = createNoopTelemetry();
    expect(() => telemetry.setUser({ id: 'user-1' })).not.toThrow();
    expect(() => telemetry.setUser(null)).not.toThrow();
    expect(() => telemetry.captureException(new Error('boom'))).not.toThrow();
    expect(await telemetry.flush()).toBeUndefined();
    expect(await telemetry.flush(2000)).toBeUndefined();
  });
});
