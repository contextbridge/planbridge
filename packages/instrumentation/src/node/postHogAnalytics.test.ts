import { buildInfo } from '@contextbridge/context/testFactories';
import { describe, expect, it } from 'bun:test';
import { type PostHogClient, createPostHogAnalytics } from './postHogAnalytics.ts';

describe('createPostHogAnalytics', () => {
  it('seeds super-properties from buildInfo on every identify and capture', () => {
    const fake = createFakeClient();
    const analytics = createPostHogAnalytics({
      buildInfo: buildInfo.build({ version: '0.0.0-test', environment: 'production', channel: 'stable' }),
      distinctId: 'user-1',
      surface: 'cli',
      client: fake.client,
    });

    analytics.identify('user-1');
    analytics.capture('event_one', { foo: 'bar' });

    expect(fake.identify[0]).toEqual({
      distinctId: 'user-1',
      properties: {
        cb_surface: 'cli',
        cb_version: '0.0.0-test',
        cb_environment: 'production',
        cb_channel: 'stable',
      },
    });
    expect(fake.capture[0]).toEqual({
      distinctId: 'user-1',
      event: 'event_one',
      properties: {
        cb_surface: 'cli',
        cb_version: '0.0.0-test',
        cb_environment: 'production',
        cb_channel: 'stable',
        foo: 'bar',
      },
    });
  });

  it('register() merges properties into subsequent identify and capture payloads', () => {
    const fake = createFakeClient();
    const analytics = createPostHogAnalytics({
      buildInfo: buildInfo.build(),
      distinctId: 'user-1',
      surface: 'cli',
      client: fake.client,
    });

    analytics.register({ cb_command: 'plan' });
    analytics.identify('user-1');
    analytics.capture('event', { foo: 'bar' });

    expect(fake.identify[0]?.properties).toMatchObject({ cb_command: 'plan' });
    expect(fake.capture[0]?.properties).toMatchObject({ cb_command: 'plan', foo: 'bar' });
  });

  it('explicit per-call properties override registered super-properties', () => {
    const fake = createFakeClient();
    const analytics = createPostHogAnalytics({
      buildInfo: buildInfo.build(),
      distinctId: 'user-1',
      surface: 'cli',
      client: fake.client,
    });

    analytics.register({ cb_command: 'plan' });
    analytics.capture('event', { cb_command: 'override' });

    expect(fake.capture[0]?.properties).toMatchObject({ cb_command: 'override' });
  });

  it('does not auto-identify on construction', () => {
    const fake = createFakeClient();
    createPostHogAnalytics({
      buildInfo: buildInfo.build(),
      distinctId: 'user-1',
      surface: 'cli',
      client: fake.client,
    });

    expect(fake.identify).toEqual([]);
  });

  it('captures use the constructor distinctId, not the one passed to identify()', () => {
    const fake = createFakeClient();
    const analytics = createPostHogAnalytics({
      buildInfo: buildInfo.build(),
      distinctId: 'original',
      surface: 'cli',
      client: fake.client,
    });

    analytics.identify('different');
    analytics.capture('event');

    expect(fake.capture[0]?.distinctId).toBe('original');
  });

  it('swallows errors thrown by the underlying client so telemetry never breaks the CLI', () => {
    const throwing: PostHogClient = {
      identify: () => {
        throw new Error('identify boom');
      },
      capture: () => {
        throw new Error('capture boom');
      },
      flush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    };
    const analytics = createPostHogAnalytics({
      buildInfo: buildInfo.build(),
      distinctId: 'user-1',
      surface: 'cli',
      client: throwing,
    });

    expect(() => analytics.identify('user-1')).not.toThrow();
    expect(() => analytics.capture('event')).not.toThrow();
  });

  it('flush and shutdown swallow rejected promises from the underlying client', () => {
    const rejecting: PostHogClient = {
      identify: () => {},
      capture: () => {},
      flush: () => Promise.reject(new Error('flush boom')),
      shutdown: () => Promise.reject(new Error('shutdown boom')),
    };
    const analytics = createPostHogAnalytics({
      buildInfo: buildInfo.build(),
      distinctId: 'user-1',
      surface: 'cli',
      client: rejecting,
    });

    expect(analytics.flush()).resolves.toBeUndefined();
    expect(analytics.shutdown()).resolves.toBeUndefined();
  });
});

interface RecordedIdentifyCall {
  readonly distinctId: string | undefined;
  readonly properties?: Record<string, unknown>;
}

interface RecordedCaptureCall {
  readonly distinctId: string | undefined;
  readonly event: string;
  readonly properties?: Record<string, unknown>;
}

interface FakeClientFixture {
  readonly client: PostHogClient;
  readonly identify: RecordedIdentifyCall[];
  readonly capture: RecordedCaptureCall[];
}

function createFakeClient(): FakeClientFixture {
  const identify: RecordedIdentifyCall[] = [];
  const capture: RecordedCaptureCall[] = [];
  return {
    identify,
    capture,
    client: {
      identify: (input) => {
        identify.push({ distinctId: input.distinctId, properties: input.properties });
      },
      capture: (input) => {
        capture.push({ distinctId: input.distinctId, event: input.event, properties: input.properties });
      },
      flush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    },
  };
}
