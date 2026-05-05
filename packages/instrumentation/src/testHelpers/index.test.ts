import { describe, expect, it } from 'bun:test';
import { createFakeAnalytics, createFakeTelemetry } from './index.ts';

describe('createFakeAnalytics', () => {
  it('records captures and identifies', () => {
    const analytics = createFakeAnalytics();
    analytics.identify('user-1', { plan: 'pro' });
    analytics.capture('event_one', { foo: 'bar' });
    analytics.capture('event_two');

    expect(analytics.identifies).toEqual([{ distinctId: 'user-1', properties: { plan: 'pro' } }]);
    expect(analytics.captures).toEqual([
      { event: 'event_one', properties: { foo: 'bar' } },
      { event: 'event_two', properties: {} },
    ]);
  });

  it('merges registered super-properties into subsequent identify and capture payloads', () => {
    const analytics = createFakeAnalytics();
    analytics.register({ cb_command: 'plan', cb_surface: 'cli' });
    analytics.identify('user-1');
    analytics.capture('event', { foo: 'bar' });

    expect(analytics.superProperties).toEqual({ cb_command: 'plan', cb_surface: 'cli' });
    expect(analytics.identifies[0]?.properties).toEqual({ cb_command: 'plan', cb_surface: 'cli' });
    expect(analytics.captures[0]?.properties).toEqual({
      cb_command: 'plan',
      cb_surface: 'cli',
      foo: 'bar',
    });
  });

  it('lets explicit properties override super-properties on a single call', () => {
    const analytics = createFakeAnalytics();
    analytics.register({ cb_command: 'plan' });
    analytics.capture('event', { cb_command: 'override' });

    expect(analytics.captures[0]?.properties).toEqual({ cb_command: 'override' });
  });

  it('counts flush and shutdown calls', async () => {
    const analytics = createFakeAnalytics();
    await analytics.flush();
    await analytics.flush();
    await analytics.shutdown();

    expect(analytics.flushCount).toBe(2);
    expect(analytics.shutdownCount).toBe(1);
  });
});

describe('createFakeTelemetry', () => {
  it('records the last setUser call', () => {
    const telemetry = createFakeTelemetry();
    expect(telemetry.user).toBeNull();

    telemetry.setUser({ id: 'user-1' });
    expect(telemetry.user).toEqual({ id: 'user-1' });

    telemetry.setUser(null);
    expect(telemetry.user).toBeNull();
  });

  it('records captured exceptions', () => {
    const telemetry = createFakeTelemetry();
    const err = new Error('boom');
    telemetry.captureException(err);
    telemetry.captureException('string error');

    expect(telemetry.exceptions).toEqual([err, 'string error']);
  });

  it('counts flush calls', async () => {
    const telemetry = createFakeTelemetry();
    await telemetry.flush();
    await telemetry.flush(1000);
    expect(telemetry.flushCount).toBe(2);
  });
});
