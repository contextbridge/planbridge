import type { BuildInfo } from '@contextbridge/context';
import * as Sentry from '@sentry/bun';
import type { Telemetry, TelemetryUser } from '../shared/index.ts';

export interface CreateSentryTelemetryOptions {
  readonly buildInfo: BuildInfo;
  readonly distinctId: string;
  readonly surface: string;
}

export function createSentryTelemetry(options: CreateSentryTelemetryOptions): Telemetry {
  const { buildInfo, distinctId, surface } = options;

  Sentry.init({
    dsn: buildInfo.sentryCliDsn,
    environment: buildInfo.environment,
    release: buildInfo.version,
    initialScope: {
      tags: { cb_surface: surface, cb_channel: buildInfo.channel },
      user: { id: distinctId },
    },
    integrations: [Sentry.pinoIntegration({ error: { levels: ['error', 'fatal'] } })],
  });

  return {
    setUser: (user: TelemetryUser | null) => {
      Sentry.setUser(user);
    },
    captureException: (err) => {
      Sentry.captureException(err);
    },
    flush: async (timeoutMs = 2000) => {
      await Sentry.flush(timeoutMs);
    },
  };
}
