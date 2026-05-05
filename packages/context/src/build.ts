import type { CbChannel, CbEnvironment } from './buildInfo.ts';

export const CB_DEFINE_VERSION = '__CB_VERSION__';
export const CB_DEFINE_ENVIRONMENT = '__CB_ENVIRONMENT__';
export const CB_DEFINE_CHANNEL = '__CB_CHANNEL__';
export const CB_DEFINE_POSTHOG_KEY = '__CB_POSTHOG_KEY__';
export const CB_DEFINE_POSTHOG_HOST = '__CB_POSTHOG_HOST__';
export const CB_DEFINE_SENTRY_CLI_DSN = '__CB_SENTRY_CLI_DSN__';
export const CB_DEFINE_SENTRY_FRONTEND_DSN = '__CB_SENTRY_FRONTEND_DSN__';

export interface CbBuildInjections {
  readonly version: string;
  readonly environment: CbEnvironment;
  readonly channel: CbChannel;
  readonly postHogKey?: string;
  readonly postHogHost?: string;
  readonly sentryCliDsn?: string;
  readonly sentryFrontendDsn?: string;
}

export function cbBuildDefines(injected: CbBuildInjections): Record<string, string> {
  const {
    version,
    environment,
    channel,
    postHogKey = '',
    postHogHost = '',
    sentryCliDsn = '',
    sentryFrontendDsn = '',
  } = injected;

  return {
    [CB_DEFINE_VERSION]: JSON.stringify(version),
    [CB_DEFINE_ENVIRONMENT]: JSON.stringify(environment),
    [CB_DEFINE_CHANNEL]: JSON.stringify(channel),
    [CB_DEFINE_POSTHOG_KEY]: JSON.stringify(postHogKey),
    [CB_DEFINE_POSTHOG_HOST]: JSON.stringify(postHogHost),
    [CB_DEFINE_SENTRY_CLI_DSN]: JSON.stringify(sentryCliDsn),
    [CB_DEFINE_SENTRY_FRONTEND_DSN]: JSON.stringify(sentryFrontendDsn),
  };
}
