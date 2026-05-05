declare const __CB_VERSION__: string | undefined;
declare const __CB_ENVIRONMENT__: string | undefined;
declare const __CB_CHANNEL__: string | undefined;
declare const __CB_POSTHOG_KEY__: string | undefined;
declare const __CB_POSTHOG_HOST__: string | undefined;
declare const __CB_SENTRY_CLI_DSN__: string | undefined;
declare const __CB_SENTRY_FRONTEND_DSN__: string | undefined;

export type CbEnvironment = 'local' | 'production';
export type CbChannel = 'stable' | 'alpha';

export interface BuildInfo {
  readonly version: string;
  readonly environment: CbEnvironment;
  readonly channel: CbChannel;
  readonly postHogKey: string;
  readonly postHogHost: string;
  readonly sentryCliDsn: string;
  readonly sentryFrontendDsn: string;
}

const environment: CbEnvironment =
  typeof __CB_ENVIRONMENT__ === 'string' && __CB_ENVIRONMENT__ === 'production' ? 'production' : 'local';

const channel: CbChannel = typeof __CB_CHANNEL__ === 'string' && __CB_CHANNEL__ === 'alpha' ? 'alpha' : 'stable';

export const BUILD_INFO: BuildInfo = Object.freeze({
  version: typeof __CB_VERSION__ === 'string' ? __CB_VERSION__ : '0.0.0-development',
  environment,
  channel,
  postHogKey: typeof __CB_POSTHOG_KEY__ === 'string' ? __CB_POSTHOG_KEY__ : '',
  postHogHost: typeof __CB_POSTHOG_HOST__ === 'string' ? __CB_POSTHOG_HOST__ : '',
  sentryCliDsn: typeof __CB_SENTRY_CLI_DSN__ === 'string' ? __CB_SENTRY_CLI_DSN__ : '',
  sentryFrontendDsn: typeof __CB_SENTRY_FRONTEND_DSN__ === 'string' ? __CB_SENTRY_FRONTEND_DSN__ : '',
});
