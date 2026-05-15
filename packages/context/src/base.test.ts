import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import { createBaseContext, isTelemetryDisabled } from './base.ts';
import { BUILD_INFO } from './buildInfo.ts';
import { buildInfo } from './testFactories.ts';

describe('createBaseContext', () => {
  const logger = pino({ level: 'silent' });
  const distinctId = 'test-distinct-id';
  const telemetryDisabled = true;

  it('uses the module-level BUILD_INFO when no override is given', () => {
    const ctx = createBaseContext({ logger, distinctId, telemetryDisabled });
    expect(ctx.buildInfo).toBe(BUILD_INFO);
  });

  it('accepts a buildInfo override for tests', () => {
    const ctx = createBaseContext({
      logger,
      distinctId,
      telemetryDisabled,
      buildInfo: buildInfo.build({ version: '1.2.3' }),
    });
    expect(ctx.buildInfo.version).toBe('1.2.3');
  });

  it('freezes the returned context', () => {
    const ctx = createBaseContext({ logger, distinctId, telemetryDisabled });
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('exposes the logger, distinctId, and telemetryDisabled passed in', () => {
    const ctx = createBaseContext({ logger, distinctId, telemetryDisabled: false });
    expect(ctx.logger).toBe(logger);
    expect(ctx.distinctId).toBe(distinctId);
    expect(ctx.telemetryDisabled).toBe(false);
  });

  it('defaults analytics and telemetry to noop implementations', () => {
    const ctx = createBaseContext({ logger, distinctId, telemetryDisabled });
    expect(typeof ctx.analytics.capture).toBe('function');
    expect(typeof ctx.telemetry.captureException).toBe('function');
  });
});

describe('isTelemetryDisabled', () => {
  const productionBuildInfo = buildInfo.build({
    environment: 'production',
    postHogKey: 'test-posthog-key',
    sentryCliDsn: 'https://real@sentry.io/cli',
    sentryFrontendDsn: 'https://real@sentry.io/frontend',
  });

  it('returns true when DO_NOT_TRACK is true', () => {
    expect(isTelemetryDisabled({ buildInfo: productionBuildInfo, env: { DO_NOT_TRACK: true } })).toBe(true);
  });

  it('returns true when CONTEXTBRIDGE_TELEMETRY_DISABLED is true', () => {
    expect(
      isTelemetryDisabled({ buildInfo: productionBuildInfo, env: { CONTEXTBRIDGE_TELEMETRY_DISABLED: true } }),
    ).toBe(true);
  });

  it('returns true when CI is true', () => {
    expect(isTelemetryDisabled({ buildInfo: productionBuildInfo, env: { CI: true } })).toBe(true);
  });

  it('returns true when the build environment is not production', () => {
    expect(
      isTelemetryDisabled({
        buildInfo: buildInfo.build({ ...productionBuildInfo, environment: 'local' }),
      }),
    ).toBe(true);
  });

  it('returns false in production with telemetry config and no opt-out', () => {
    expect(isTelemetryDisabled({ buildInfo: productionBuildInfo })).toBe(false);
    expect(
      isTelemetryDisabled({
        buildInfo: productionBuildInfo,
        env: { DO_NOT_TRACK: false, CONTEXTBRIDGE_TELEMETRY_DISABLED: false },
      }),
    ).toBe(false);
  });
});
