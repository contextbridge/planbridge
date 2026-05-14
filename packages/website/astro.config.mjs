import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://plan.contextbridge.ai',
  integrations: [
    icon(),
    react(),
    expressiveCode({
      themes: ['github-dark', 'github-light'],
    }),
    starlight({
      title: 'PlanBridge',
      description: 'Human-in-the-loop annotation for AI coding sessions.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/contextbridge/planbridge' }],
      favicon: '/favicon.svg',
      customCss: ['./src/styles/main.css'],
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
