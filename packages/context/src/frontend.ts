/// <reference lib="dom" />
import { createBrowserInstrumentation } from '@contextbridge/instrumentation/browser';
import type { FrontendTelemetry } from '@contextbridge/instrumentation/frontend';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import { type BaseContext, createBaseContext } from './base.ts';
import { BUILD_INFO, type BuildInfo } from './buildInfo.ts';
import { type Logger, createLogger } from './frontend/logger.ts';
import { type FrontendBrowser, FrontendBrowserImpl } from './FrontendBrowserImpl.ts';

export {
  type Logger,
  type LevelWithSilent,
  type BrowserLoggerOptions,
  type BrowserPinoTransmit,
  createLogger,
} from './frontend/logger.ts';
export { type BaseContext, isTelemetryDisabled } from './base.ts';
export { type BuildInfo, BUILD_INFO } from './buildInfo.ts';
export {
  type FrontendBrowser,
  FrontendBrowserImpl,
  type FrontendBrowserWindow,
  type ScheduleTimeout,
  type TimeoutCancel,
} from './FrontendBrowserImpl.ts';
export { type FrontendTelemetry } from '@contextbridge/instrumentation/frontend';

export interface FrontendContext extends BaseContext {
  readonly telemetry: FrontendTelemetry;
  readonly browser: FrontendBrowser;
}

export interface CreateFrontendContextInput {
  readonly config: FrontendConfig;
  readonly surface: string;
  readonly buildInfo?: BuildInfo;
  readonly logger?: Logger;
  readonly browser?: FrontendBrowser;
}

export function createFrontendContext(input: CreateFrontendContextInput): FrontendContext {
  const {
    config,
    surface,
    buildInfo = BUILD_INFO,
    logger: loggerOverride,
    browser = new FrontendBrowserImpl(),
  } = input;

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
    browser,
  });
}
