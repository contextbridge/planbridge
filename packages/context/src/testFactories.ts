import { Factory } from 'fishery';
import type { BuildInfo } from './buildInfo.ts';

export const buildInfo = Factory.define<BuildInfo>(() => ({
  version: 'test',
  environment: 'local',
  channel: 'stable',
  postHogKey: 'NOT_REAL_POSTHOG_KEY',
  postHogHost: 'https://not-real.test',
  sentryCliDsn: 'NOT_REAL_SENTRY_CLI_DSN',
  sentryFrontendDsn: 'NOT_REAL_SENTRY_FRONTEND_DSN',
}));
