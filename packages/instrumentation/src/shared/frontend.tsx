import type { LevelWithSilent, LogEvent } from 'pino';
import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import { type Telemetry, createNoopTelemetry } from './index.ts';

export interface BrowserPinoTransmit {
  readonly level: LevelWithSilent;
  readonly send: (level: string, logEvent: LogEvent) => void;
}

export interface FrontendTelemetry extends Telemetry {
  readonly ErrorBoundary: ComponentType<PropsWithChildren>;
  /**
   * Pino-compatible transmit config that forwards log records at `level` or
   * above to the telemetry backend. `createFrontendContext` wires this into
   * the browser logger so `logger.error(...)` auto-reports to Sentry without
   * explicit `captureException` calls at the site — mirroring the Node-side
   * `pinoIntegration` pattern.
   */
  readonly pinoTransmit: BrowserPinoTransmit;
}

export function createNoopFrontendTelemetry(): FrontendTelemetry {
  return {
    ...createNoopTelemetry(),
    ErrorBoundary: PassthroughErrorBoundary,
    pinoTransmit: { level: 'silent', send: () => {} },
  };
}

function PassthroughErrorBoundary({ children }: PropsWithChildren): ReactElement {
  return <>{children}</>;
}
