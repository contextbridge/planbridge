import type { StorybookConfig } from '@storybook/react-vite';

const skipDemo = process.env.SKIP_DEMO_STORIES === 'true';

const config: StorybookConfig = {
  stories: [skipDemo ? '../src/**/!(*.demo).stories.@(js|jsx|mjs|ts|tsx)' : '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [],
  framework: '@storybook/react-vite',
};
export default config;
