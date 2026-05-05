import type { BuildInfo } from '@contextbridge/context';
import { describe, it } from 'bun:test';
import { createNodeInstrumentation } from './index.ts';

const testBuildInfo: BuildInfo = Object.freeze({
  version: '0.0.0-test',
  environment: 'production',
  channel: 'stable',
  postHogKey: 'test-posthog-key',
  postHogHost: 'https://posthog.example.test',
  sentryCliDsn: 'https://test@sentry.io/cli',
  sentryFrontendDsn: 'https://test@sentry.io/frontend',
});

describe('createNodeInstrumentation', () => {
  it('returns noop clients when telemetry is disabled', () => {
    const inst = createNodeInstrumentation({
      buildInfo: testBuildInfo,
      distinctId: 'test-id',
      telemetryDisabled: true,
    });
    inst.analytics.capture('event');
    inst.telemetry.captureException(new Error('boom'));
  });
});
