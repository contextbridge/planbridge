import type { BuildInfo } from '@contextbridge/context';
import * as Sentry from '@sentry/react';
import type { LogEvent } from 'pino';
import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import type { BrowserPinoTransmit, FrontendTelemetry } from '../shared/frontend.tsx';
import type { TelemetryUser } from '../shared/index.ts';

export interface CreateSentryBrowserTelemetryOptions {
  readonly buildInfo: BuildInfo;
  readonly distinctId: string;
  readonly surface: string;
}

export function createSentryBrowserTelemetry(options: CreateSentryBrowserTelemetryOptions): FrontendTelemetry {
  const { buildInfo, distinctId, surface } = options;

  Sentry.init({
    dsn: buildInfo.sentryFrontendDsn,
    environment: buildInfo.environment,
    release: buildInfo.version,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
    initialScope: {
      tags: { cb_surface: surface, cb_channel: buildInfo.channel },
      user: { id: distinctId },
    },
  });

  const ErrorBoundary: ComponentType<PropsWithChildren> = ({ children }) => (
    <Sentry.ErrorBoundary fallback={fallback}>{children}</Sentry.ErrorBoundary>
  );

  // Forwards pino log records at level >= 'error' to Sentry. Mirrors the
  // Node-side `Sentry.pinoIntegration` behavior so handler code can rely on
  // `logger.error({ err }, '...')` auto-reporting on both runtimes.
  const pinoTransmit: BrowserPinoTransmit = {
    level: 'error',
    send: (level, logEvent) => {
      const err = extractError(logEvent);
      if (err) {
        Sentry.captureException(err);
        return;
      }
      Sentry.captureMessage(extractMessage(logEvent), level === 'fatal' ? 'fatal' : 'error');
    },
  };

  return {
    ErrorBoundary,
    pinoTransmit,
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

function extractError(logEvent: LogEvent): unknown {
  for (const message of logEvent.messages) {
    if (message && typeof message === 'object' && 'err' in message) {
      return (message as { err: unknown }).err;
    }
    if (message instanceof Error) {
      return message;
    }
  }
  return null;
}

function extractMessage(logEvent: LogEvent): string {
  for (const message of logEvent.messages) {
    if (typeof message === 'string') return message;
  }
  return 'log event';
}

const fallback: ReactElement = (
  <div style={{ padding: 24, fontFamily: 'system-ui', color: '#ddd', background: '#111', minHeight: '100vh' }}>
    <h1>Something went wrong.</h1>
    <p>The plan-review UI hit an unexpected error. Please close this tab and retry from the terminal.</p>
  </div>
);
