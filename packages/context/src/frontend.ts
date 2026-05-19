/// <reference lib="dom" />
import { createBrowserInstrumentation } from '@contextbridge/instrumentation/browser';
import type { FrontendTelemetry } from '@contextbridge/instrumentation/frontend';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import { type BaseContext, createBaseContext } from './base.ts';
import { BUILD_INFO, type BuildInfo } from './buildInfo.ts';
import { type Logger, createLogger } from './frontend/logger.ts';

export {
  type Logger,
  type LevelWithSilent,
  type BrowserLoggerOptions,
  type BrowserPinoTransmit,
  createLogger,
} from './frontend/logger.ts';
export { type BaseContext, isTelemetryDisabled } from './base.ts';
export { type BuildInfo, BUILD_INFO } from './buildInfo.ts';
export { type FrontendTelemetry } from '@contextbridge/instrumentation/frontend';

export type ScheduleTimeout = (handler: () => void, delayMs: number) => () => void;
export type AddBeforeUnloadGuard = (handler: (event: BeforeUnloadEvent) => void) => () => void;

export interface FrontendBrowser {
  readonly closeWindow: () => void;
  readonly scheduleTimeout: ScheduleTimeout;
  readonly addBeforeUnloadGuard: AddBeforeUnloadGuard;
}

export interface FrontendContext extends BaseContext {
  readonly telemetry: FrontendTelemetry;
  readonly browser: FrontendBrowser;
}

export interface CreateFrontendContextInput {
  readonly config: FrontendConfig;
  readonly surface: string;
  readonly buildInfo?: BuildInfo;
  readonly logger?: Logger;
  readonly browser?: Partial<FrontendBrowser>;
}

export function createFrontendContext(input: CreateFrontendContextInput): FrontendContext {
  const { config, surface, buildInfo = BUILD_INFO, logger: loggerOverride, browser: browserOverride } = input;

  const { distinctId, telemetryDisabled } = config;

  // Instrument first: Sentry.init happens here. The logger is created after
  // so pino's `transmit` hook (supplied by the telemetry factory) is wired up
  // and `logger.error(...)` auto-forwards to Sentry without explicit
  // captureException calls at handler sites.
  const { analytics, telemetry } = createBrowserInstrumentation({
    buildInfo,
    distinctId,
    telemetryDisabled,
    surface,
  });

  const logger = loggerOverride ?? createLogger({ transmit: telemetry.pinoTransmit });

  return Object.freeze({
    ...createBaseContext({ buildInfo, logger, distinctId, telemetryDisabled, analytics, telemetry }),
    telemetry,
    browser: Object.freeze({
      ...defaultFrontendBrowser,
      ...browserOverride,
    }),
  });
}

const defaultFrontendBrowser: FrontendBrowser = Object.freeze({
  closeWindow: () => {
    window.close();
  },
  scheduleTimeout: (handler: () => void, delayMs: number) => {
    const id = window.setTimeout(handler, delayMs);
    return () => {
      window.clearTimeout(id);
    };
  },
  addBeforeUnloadGuard: (handler: (event: BeforeUnloadEvent) => void) => {
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  },
});
