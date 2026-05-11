import {
  type Analytics,
  type Telemetry,
  createNoopAnalytics,
  createNoopTelemetry,
} from '@contextbridge/instrumentation';
import { BUILD_INFO, type BuildInfo } from './buildInfo.ts';
import { type Fetcher, FetcherImpl } from './FetcherImpl.ts';
import type { Logger } from './logger.ts';

export interface BaseContext {
  readonly buildInfo: BuildInfo;
  readonly logger: Logger;
  readonly distinctId: string;
  readonly telemetryDisabled: boolean;
  readonly analytics: Analytics;
  readonly telemetry: Telemetry;
  readonly fetcher: Fetcher;
}

export interface CreateBaseContextInput {
  readonly logger: Logger;
  readonly distinctId: string;
  readonly telemetryDisabled: boolean;
  readonly buildInfo?: BuildInfo;
  readonly analytics?: Analytics;
  readonly telemetry?: Telemetry;
  readonly fetcher?: Fetcher;
}

export function createBaseContext(input: CreateBaseContextInput): BaseContext {
  const {
    logger,
    distinctId,
    telemetryDisabled,
    buildInfo = BUILD_INFO,
    analytics = createNoopAnalytics(),
    telemetry = createNoopTelemetry(),
    fetcher = new FetcherImpl(),
  } = input;
  return Object.freeze({ buildInfo, logger, distinctId, telemetryDisabled, analytics, telemetry, fetcher });
}

export interface TelemetryOptOutEnv {
  readonly DO_NOT_TRACK?: boolean;
  readonly CONTEXTBRIDGE_TELEMETRY_DISABLED?: boolean;
  readonly CI?: boolean;
}

export interface IsTelemetryDisabledInput {
  readonly buildInfo: BuildInfo;
  readonly env?: TelemetryOptOutEnv;
}

export function isTelemetryDisabled(input: IsTelemetryDisabledInput): boolean {
  const { buildInfo, env } = input;
  if (env && isEnvOptOut(env)) return true;
  return buildInfo.environment !== 'production';
}

function isEnvOptOut(env: TelemetryOptOutEnv): boolean {
  return Boolean(env.DO_NOT_TRACK || env.CONTEXTBRIDGE_TELEMETRY_DISABLED || env.CI);
}
