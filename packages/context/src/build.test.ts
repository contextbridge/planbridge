import { describe, expect, it } from 'bun:test';
import {
  CB_DEFINE_CHANNEL,
  CB_DEFINE_ENVIRONMENT,
  CB_DEFINE_POSTHOG_HOST,
  CB_DEFINE_POSTHOG_KEY,
  CB_DEFINE_SENTRY_CLI_DSN,
  CB_DEFINE_SENTRY_FRONTEND_DSN,
  CB_DEFINE_VERSION,
  cbBuildDefines,
  cbBuildDefinesFromEnv,
  parseBuildEnv,
} from './build.ts';

describe('cbBuildDefines', () => {
  it('exposes the build define keys as constants', () => {
    expect(CB_DEFINE_VERSION).toBe('__CB_VERSION__');
    expect(CB_DEFINE_ENVIRONMENT).toBe('__CB_ENVIRONMENT__');
    expect(CB_DEFINE_CHANNEL).toBe('__CB_CHANNEL__');
    expect(CB_DEFINE_POSTHOG_KEY).toBe('__CB_POSTHOG_KEY__');
    expect(CB_DEFINE_POSTHOG_HOST).toBe('__CB_POSTHOG_HOST__');
    expect(CB_DEFINE_SENTRY_CLI_DSN).toBe('__CB_SENTRY_CLI_DSN__');
    expect(CB_DEFINE_SENTRY_FRONTEND_DSN).toBe('__CB_SENTRY_FRONTEND_DSN__');
  });

  it('returns JSON-stringified define values keyed by name', () => {
    const defines = cbBuildDefines({ version: '1.2.3', environment: 'production', channel: 'stable' });
    expect(defines).toEqual({
      __CB_VERSION__: '"1.2.3"',
      __CB_ENVIRONMENT__: '"production"',
      __CB_CHANNEL__: '"stable"',
      __CB_POSTHOG_KEY__: '""',
      __CB_POSTHOG_HOST__: '""',
      __CB_SENTRY_CLI_DSN__: '""',
      __CB_SENTRY_FRONTEND_DSN__: '""',
    });
  });

  it('includes explicit telemetry define values when provided', () => {
    const defines = cbBuildDefines({
      version: '1.2.3',
      environment: 'production',
      channel: 'stable',
      postHogKey: 'test-posthog-key',
      postHogHost: 'https://posthog.example.test',
      sentryCliDsn: 'https://cli@example.test/1',
      sentryFrontendDsn: 'https://frontend@example.test/1',
    });

    expect(defines[CB_DEFINE_POSTHOG_KEY]).toBe('"test-posthog-key"');
    expect(defines[CB_DEFINE_POSTHOG_HOST]).toBe('"https://posthog.example.test"');
    expect(defines[CB_DEFINE_SENTRY_CLI_DSN]).toBe('"https://cli@example.test/1"');
    expect(defines[CB_DEFINE_SENTRY_FRONTEND_DSN]).toBe('"https://frontend@example.test/1"');
  });

  it('produces values safe to pass to Bun --define or Vite define', () => {
    const defines = cbBuildDefines({ version: '0.0.0-alpha.1', environment: 'local', channel: 'alpha' });
    expect(JSON.parse(defines[CB_DEFINE_VERSION]!)).toBe('0.0.0-alpha.1');
    expect(JSON.parse(defines[CB_DEFINE_ENVIRONMENT]!)).toBe('local');
    expect(JSON.parse(defines[CB_DEFINE_CHANNEL]!)).toBe('alpha');
    expect(JSON.parse(defines[CB_DEFINE_POSTHOG_KEY]!)).toBe('');
  });
});

describe('parseBuildEnv', () => {
  it('applies defaults when env is empty', () => {
    expect(parseBuildEnv({})).toMatchObject({
      version: '0.0.0-development',
      environment: 'local',
      channel: 'stable',
      postHogKey: '',
      postHogHost: '',
      sentryCliDsn: '',
      sentryFrontendDsn: '',
    });
  });

  it('reads injected build values from env', () => {
    expect(
      parseBuildEnv({
        __CB_VERSION__: '1.2.3',
        __CB_ENVIRONMENT__: 'production',
        __CB_CHANNEL__: 'alpha',
        __CB_POSTHOG_KEY__: 'phc_xyz',
        __CB_POSTHOG_HOST__: 'https://posthog.example.test',
        __CB_SENTRY_CLI_DSN__: 'https://cli@example.test/1',
        __CB_SENTRY_FRONTEND_DSN__: 'https://frontend@example.test/1',
      }),
    ).toMatchObject({
      version: '1.2.3',
      environment: 'production',
      channel: 'alpha',
      postHogKey: 'phc_xyz',
      postHogHost: 'https://posthog.example.test',
      sentryCliDsn: 'https://cli@example.test/1',
      sentryFrontendDsn: 'https://frontend@example.test/1',
    });
  });

  it('rejects invalid environment values', () => {
    expect(() => parseBuildEnv({ __CB_ENVIRONMENT__: 'staging' })).toThrow(/__CB_ENVIRONMENT__/);
  });

  it('rejects invalid channel values', () => {
    expect(() => parseBuildEnv({ __CB_CHANNEL__: 'beta' })).toThrow(/__CB_CHANNEL__/);
  });

  it('rejects empty version strings', () => {
    expect(() => parseBuildEnv({ __CB_VERSION__: '' })).toThrow(/__CB_VERSION__/);
  });

  it('allows missing telemetry keys for local builds', () => {
    expect(() => parseBuildEnv({ __CB_ENVIRONMENT__: 'local' })).not.toThrow();
  });

  it('rejects production builds missing telemetry keys', () => {
    const attempt = () =>
      parseBuildEnv({
        __CB_VERSION__: '1.2.3',
        __CB_ENVIRONMENT__: 'production',
      });

    expect(attempt).toThrow(/__CB_POSTHOG_KEY__/);
    expect(attempt).toThrow(/__CB_POSTHOG_HOST__/);
    expect(attempt).toThrow(/__CB_SENTRY_CLI_DSN__/);
    expect(attempt).toThrow(/__CB_SENTRY_FRONTEND_DSN__/);
  });

  it('rejects production builds left at the development version sentinel', () => {
    expect(() =>
      parseBuildEnv({
        __CB_ENVIRONMENT__: 'production',
        __CB_POSTHOG_KEY__: 'phc_xyz',
        __CB_POSTHOG_HOST__: 'https://posthog.example.test',
        __CB_SENTRY_CLI_DSN__: 'https://cli@example.test/1',
        __CB_SENTRY_FRONTEND_DSN__: 'https://frontend@example.test/1',
      }),
    ).toThrow(/__CB_VERSION__/);
  });

  it('accepts production builds with all required values set', () => {
    expect(() =>
      parseBuildEnv({
        __CB_VERSION__: '1.2.3',
        __CB_ENVIRONMENT__: 'production',
        __CB_POSTHOG_KEY__: 'phc_xyz',
        __CB_POSTHOG_HOST__: 'https://posthog.example.test',
        __CB_SENTRY_CLI_DSN__: 'https://cli@example.test/1',
        __CB_SENTRY_FRONTEND_DSN__: 'https://frontend@example.test/1',
      }),
    ).not.toThrow();
  });
});

describe('cbBuildDefinesFromEnv', () => {
  it('reads env vars and produces JSON-stringified define values', () => {
    expect(
      cbBuildDefinesFromEnv({
        __CB_VERSION__: '4.5.6',
        __CB_ENVIRONMENT__: 'local',
        __CB_CHANNEL__: 'stable',
      }),
    ).toMatchObject({
      [CB_DEFINE_VERSION]: '"4.5.6"',
      [CB_DEFINE_ENVIRONMENT]: '"local"',
      [CB_DEFINE_CHANNEL]: '"stable"',
    });
  });
});
