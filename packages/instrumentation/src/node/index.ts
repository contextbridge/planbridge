import type { BuildInfo } from '@contextbridge/context';
import { type Analytics, type Telemetry, createNoopAnalytics, createNoopTelemetry } from '../shared/index.ts';
import { createPostHogAnalytics } from './postHogAnalytics.ts';
import { createSentryTelemetry } from './sentryTelemetry.ts';

export { type AnonymousIdEnv, getOrCreateAnonymousId } from './anonymousId.ts';
export {
  reportHarnessDiscovery,
  type HarnessDiscoveryEnv,
  type HarnessTelemetryDetection,
  type ReportHarnessDiscoveryOptions,
} from './harnessDiscovery.ts';

export interface CreateNodeInstrumentationOptions {
  readonly buildInfo: BuildInfo;
  readonly distinctId: string;
  readonly telemetryDisabled: boolean;
  readonly surface?: string;
}

export interface NodeInstrumentation {
  readonly analytics: Analytics;
  readonly telemetry: Telemetry;
}

export function createNodeInstrumentation(options: CreateNodeInstrumentationOptions): NodeInstrumentation {
  const { buildInfo, distinctId, telemetryDisabled, surface = 'cli' } = options;

  if (telemetryDisabled) {
    return {
      analytics: createNoopAnalytics(),
      telemetry: createNoopTelemetry(),
    };
  }

  return {
    // Sentry.init must run before the CLI creates its logger so pinoIntegration
    // can patch pino globally. createContext() in the CLI sequences this call
    // before createLogger() to honor that invariant.
    telemetry: createSentryTelemetry({ buildInfo, distinctId, surface }),
    analytics: createPostHogAnalytics({ buildInfo, distinctId, surface }),
  };
}
