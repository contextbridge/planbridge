import { z } from 'zod';
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

const DEFAULT_VERSION = '0.0.0-development';

const LocalBuildEnvSchema = z.object({
  __CB_VERSION__: z.string().nonempty().default(DEFAULT_VERSION),
  __CB_ENVIRONMENT__: z.literal('local').default('local'),
  __CB_CHANNEL__: z.enum(['stable', 'alpha']).default('stable'),
  __CB_POSTHOG_KEY__: z.string().default(''),
  __CB_POSTHOG_HOST__: z.string().default(''),
  __CB_SENTRY_CLI_DSN__: z.string().default(''),
  __CB_SENTRY_FRONTEND_DSN__: z.string().default(''),
});

const ProductionBuildEnvSchema = z.object({
  __CB_VERSION__: z
    .string()
    .nonempty()
    .refine((value) => value !== DEFAULT_VERSION, {
      message: `__CB_VERSION__ must be set to a real version for production builds (got the development sentinel "${DEFAULT_VERSION}")`,
    }),
  __CB_ENVIRONMENT__: z.literal('production'),
  __CB_CHANNEL__: z.enum(['stable', 'alpha']).default('stable'),
  __CB_POSTHOG_KEY__: z.string().nonempty(),
  __CB_POSTHOG_HOST__: z.string().nonempty(),
  __CB_SENTRY_CLI_DSN__: z.string().nonempty(),
  __CB_SENTRY_FRONTEND_DSN__: z.string().nonempty(),
});

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

export function parseBuildEnv(env: NodeJS.ProcessEnv = process.env): CbBuildInjections {
  const schema = env.__CB_ENVIRONMENT__ === 'production' ? ProductionBuildEnvSchema : LocalBuildEnvSchema;
  const parsed = schema.parse(env);
  return {
    version: parsed.__CB_VERSION__,
    environment: parsed.__CB_ENVIRONMENT__,
    channel: parsed.__CB_CHANNEL__,
    postHogKey: parsed.__CB_POSTHOG_KEY__,
    postHogHost: parsed.__CB_POSTHOG_HOST__,
    sentryCliDsn: parsed.__CB_SENTRY_CLI_DSN__,
    sentryFrontendDsn: parsed.__CB_SENTRY_FRONTEND_DSN__,
  };
}

export function cbBuildDefinesFromEnv(env?: NodeJS.ProcessEnv): Record<string, string> {
  return cbBuildDefines(parseBuildEnv(env));
}
