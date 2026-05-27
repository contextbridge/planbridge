import type { BuildInfo } from '@contextbridge/context';
import posthog from 'posthog-js';
import type { Analytics } from '#src/shared/index.ts';
import { createStableUrlRewriter } from './stableUrlRewriter.ts';

export interface CreatePostHogBrowserAnalyticsOptions {
  readonly buildInfo: BuildInfo;
  readonly distinctId: string;
  readonly surface: string;
}

export function createPostHogBrowserAnalytics(options: CreatePostHogBrowserAnalyticsOptions): Analytics {
  const { buildInfo, distinctId, surface } = options;

  const superProperties: Record<string, unknown> = {
    cb_surface: surface,
    cb_version: buildInfo.version,
    cb_environment: buildInfo.environment,
    cb_channel: buildInfo.channel,
  };

  posthog.init(buildInfo.postHogKey, {
    api_host: buildInfo.postHogHost,
    // Privacy: plan content lives in clickable elements — autocapture would
    // leak it via $elements_text. Intentional events go through capture().
    autocapture: false,
    disable_session_recording: true,
    capture_pageview: true,
    capture_exceptions: true,
    persistence: 'memory',
    bootstrap: { distinctID: distinctId },
    before_send: createStableUrlRewriter(surface),
  });
  posthog.register(superProperties);
  posthog.identify(distinctId);

  return {
    identify: (id, properties) => {
      posthog.identify(id, properties);
    },
    capture: (event, properties) => {
      posthog.capture(event, { ...superProperties, ...properties });
    },
    register: (properties) => {
      Object.assign(superProperties, properties);
      posthog.register(properties);
    },
    flush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
}
