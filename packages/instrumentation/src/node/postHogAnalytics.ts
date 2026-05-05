import type { BuildInfo } from '@contextbridge/context';
import { ResultAsync, fromThrowable } from 'neverthrow';
import { PostHog } from 'posthog-node';
import type { Analytics } from '../shared/index.ts';

export type PostHogClient = Pick<PostHog, 'identify' | 'capture' | 'flush' | 'shutdown'>;

export interface CreatePostHogAnalyticsOptions {
  readonly buildInfo: BuildInfo;
  readonly distinctId: string;
  readonly surface: string;
  readonly client?: PostHogClient;
}

export function createPostHogAnalytics(options: CreatePostHogAnalyticsOptions): Analytics {
  const { buildInfo, distinctId, surface, client = createDefaultClient(buildInfo) } = options;

  const superProperties: Record<string, unknown> = {
    cb_surface: surface,
    cb_version: buildInfo.version,
    cb_environment: buildInfo.environment,
    cb_channel: buildInfo.channel,
  };

  // Wrap every PostHog call in neverthrow so telemetry failures are explicit
  // and can never break the CLI. Results are discarded — this is fire-and-
  // forget analytics, not critical-path code.
  const safeIdentify = fromThrowable(client.identify.bind(client));
  const safeCapture = fromThrowable(client.capture.bind(client));

  return {
    identify: (id, properties) => {
      void safeIdentify({ distinctId: id, properties: { ...superProperties, ...properties } });
    },
    capture: (event, properties) => {
      void safeCapture({ distinctId, event, properties: { ...superProperties, ...properties } });
    },
    register: (properties) => {
      Object.assign(superProperties, properties);
    },
    flush: async () => {
      await ResultAsync.fromPromise(client.flush(), (err: unknown) => err).unwrapOr(undefined);
    },
    shutdown: async () => {
      await ResultAsync.fromPromise(client.shutdown(), (err: unknown) => err).unwrapOr(undefined);
    },
  };
}

function createDefaultClient(buildInfo: BuildInfo): PostHog {
  return new PostHog(buildInfo.postHogKey, {
    host: buildInfo.postHogHost,
    // Short flush for short-lived CLI processes; flushAt=1 sends eagerly.
    flushAt: 1,
    flushInterval: 1000,
  });
}
