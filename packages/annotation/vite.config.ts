import type { CbChannel, CbEnvironment } from '@contextbridge/context';
import { cbBuildDefines } from '@contextbridge/context/build';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const isStorybook = process.env.STORYBOOK === 'true';
const {
  __CB_VERSION__: version = '0.0.0-development',
  __CB_ENVIRONMENT__: rawEnvironment = 'local',
  __CB_CHANNEL__: rawChannel = 'stable',
  __CB_POSTHOG_KEY__: postHogKey = '',
  __CB_POSTHOG_HOST__: postHogHost = '',
  __CB_SENTRY_CLI_DSN__: sentryCliDsn = '',
  __CB_SENTRY_FRONTEND_DSN__: sentryFrontendDsn = '',
} = process.env;
const environment: CbEnvironment = rawEnvironment === 'production' ? 'production' : 'local';
const channel: CbChannel = rawChannel === 'alpha' ? 'alpha' : 'stable';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
    ...(isStorybook ? [] : [viteSingleFile()]),
  ],
  define: cbBuildDefines({ version, environment, channel, postHogKey, postHogHost, sentryCliDsn, sentryFrontendDsn }),
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
