import type { BuildInfo } from '@contextbridge/context';
import { type FrontendTelemetry, createNoopFrontendTelemetry } from '../shared/frontend.tsx';
import { type Analytics, createNoopAnalytics } from '../shared/index.ts';
import { createPostHogBrowserAnalytics } from './postHogAnalytics.ts';
import { createSentryBrowserTelemetry } from './sentryTelemetry.tsx';

export interface CreateBrowserInstrumentationOptions {
  readonly buildInfo: BuildInfo;
  readonly distinctId: string;
  readonly telemetryDisabled: boolean;
  readonly surface: string;
}

export interface BrowserInstrumentation {
  readonly analytics: Analytics;
  readonly telemetry: FrontendTelemetry;
}

export function createBrowserInstrumentation(options: CreateBrowserInstrumentationOptions): BrowserInstrumentation {
  const { buildInfo, distinctId, telemetryDisabled, surface } = options;

  if (telemetryDisabled) {
    return {
      analytics: createNoopAnalytics(),
      telemetry: createNoopFrontendTelemetry(),
    };
  }

  return {
    analytics: createPostHogBrowserAnalytics({ buildInfo, distinctId, surface }),
    telemetry: createSentryBrowserTelemetry({ buildInfo, distinctId, surface }),
  };
}
