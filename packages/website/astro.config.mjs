import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://plan.contextbridge.ai',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  image: {
    responsiveStyles: true,
    layout: 'constrained',
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'ESBuild',
      cssVariable: '--cb-font-heading',
      options: {
        variants: [
          { weight: 400, style: 'normal', src: ['./src/assets/fonts/ESBuild-Regular.woff2'] },
          { weight: 400, style: 'italic', src: ['./src/assets/fonts/ESBuild-RegularItalic.woff2'] },
          { weight: 500, style: 'normal', src: ['./src/assets/fonts/ESBuild-Medium.woff2'] },
          { weight: 500, style: 'italic', src: ['./src/assets/fonts/ESBuild-MediumItalic.woff2'] },
          { weight: 600, style: 'normal', src: ['./src/assets/fonts/ESBuild-Semibold.woff2'] },
          { weight: 600, style: 'italic', src: ['./src/assets/fonts/ESBuild-SemiboldItalic.woff2'] },
          { weight: 700, style: 'normal', src: ['./src/assets/fonts/ESBuild-Bold.woff2'] },
          { weight: 700, style: 'italic', src: ['./src/assets/fonts/ESBuild-BoldItalic.woff2'] },
        ],
      },
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Atkinson Hyperlegible Next',
      cssVariable: '--cb-font-sans',
      weights: [400, 700],
      styles: ['normal', 'italic'],
    },
  ],
  integrations: [
    icon(),
    react(),
    expressiveCode({
      themes: ['github-dark', 'github-light'],
    }),
    starlight({
      title: 'PlanBridge',
      description: 'Inline comments on your coding agent plans.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/contextbridge/planbridge' }],
      favicon: '/favicon.svg',
      customCss: ['./src/styles/main.css'],
      components: {
        Head: './src/components/Head.astro',
      },
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Quickstart', slug: 'quickstart' },
            { label: 'Install', slug: 'install' },
            { label: 'How it works', slug: 'how-it-works' },
          ],
        },
        {
          label: 'Usage',
          items: [
            { label: 'Overview', slug: 'usage' },
            { label: 'Claude Code', slug: 'usage/claude-code' },
            { label: 'Codex CLI', slug: 'usage/codex' },
            { label: 'Open arbitrary content', slug: 'usage/open' },
            { label: 'Other agents', slug: 'usage/other-agents' },
          ],
        },
        {
          label: 'About',
          items: [
            { label: 'Privacy & telemetry', slug: 'privacy' },
            { label: 'Community', slug: 'community' },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'cli' },
        },
      ],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
