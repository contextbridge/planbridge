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
