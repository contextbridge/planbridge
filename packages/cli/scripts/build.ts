#!/usr/bin/env bun
import { cbBuildDefines } from '@contextbridge/context/build';
import { z } from 'zod';

const BuildEnvSchema = z.object({
  __CB_VERSION__: z.string().nonempty().default('0.0.0-development'),
  __CB_ENVIRONMENT__: z.enum(['local', 'production']).default('local'),
  __CB_CHANNEL__: z.enum(['stable', 'alpha']).default('stable'),
  __CB_POSTHOG_KEY__: z.string().default(''),
  __CB_POSTHOG_HOST__: z.string().default(''),
  __CB_SENTRY_CLI_DSN__: z.string().default(''),
  __CB_SENTRY_FRONTEND_DSN__: z.string().default(''),
});

const {
  __CB_VERSION__: version,
  __CB_ENVIRONMENT__: environment,
  __CB_CHANNEL__: channel,
  __CB_POSTHOG_KEY__: postHogKey,
  __CB_POSTHOG_HOST__: postHogHost,
  __CB_SENTRY_CLI_DSN__: sentryCliDsn,
  __CB_SENTRY_FRONTEND_DSN__: sentryFrontendDsn,
} = BuildEnvSchema.parse(process.env);

const defineArgs = Object.entries(
  cbBuildDefines({ version, environment, channel, postHogKey, postHogHost, sentryCliDsn, sentryFrontendDsn }),
).flatMap(([key, value]) => ['--define', `${key}=${value}`]);

const { exitCode } = Bun.spawnSync({
  cmd: [
    'bun',
    'build',
    '--compile',
    '--minify',
    '--sourcemap',
    ...defineArgs,
    '--outfile',
    '../../dist/contextbridge',
    './src/cli.ts',
  ],
  stdio: ['inherit', 'inherit', 'inherit'],
});

process.exit(exitCode);
