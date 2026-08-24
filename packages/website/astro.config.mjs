import { URL } from 'node:url';
import { unified } from '@astrojs/markdown-remark';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import icon from 'astro-icon';
import rehypeExternalLinks from 'rehype-external-links';
import starlightLlmsTxt from 'starlight-llms-txt';

export default defineConfig({
  site: 'https://plan.contextbridge.ai',
  redirects: {
    '/community/': '/feedback/',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  image: {
    responsiveStyles: true,
    layout: 'constrained',
  },
  markdown: {
    processor: unified({
      rehypePlugins: [[rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]],
    }),
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
    icon({ iconDir: new URL('./src/assets/brands', import.meta.url).pathname }),
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
      plugins: [
        starlightLlmsTxt({
          projectName: 'PlanBridge',
          description: 'Inline comments on coding-agent plans and markdown docs.',
          details: [
            'PlanBridge is an open-source CLI that opens coding-agent plans, specs, RFCs, and other markdown documents in a local browser review UI. Reviewers can highlight text, leave inline comments, approve, or request changes before the agent continues.',
            '',
            'What PlanBridge does:',
            '',
            '- Opens a local browser UI for reviewing markdown before an agent writes code or continues work.',
            '- Supports `contextbridge plan` for proposed implementation plans and `contextbridge open <file>` for specs, RFCs, design docs, and saved plans.',
            '- Returns the reviewer’s approval, general feedback, and inline annotations as markdown on stdout so the calling agent can act on it.',
            '- Runs locally. The review UI talks to a short-lived server on `localhost`; there is no hosted review backend.',
            '',
            'PlanBridge includes Claude Code and Codex CLI integrations, but the core commands are harness-agnostic. Any agent that can run shell commands can use the same CLI contract.',
            '',
            'Use the abridged documentation for setup and normal usage. Use the complete documentation when you need command reference details.',
          ].join('\n'),
          promote: [
            'quickstart',
            'install',
            'how-it-works',
            'usage',
            'usage/open',
            'usage/claude-code',
            'usage/codex',
            'usage/other-agents',
            'cli/open',
            'cli/plan',
          ],
          demote: ['privacy', 'community', 'cli/**'],
          exclude: ['privacy', 'community', 'cli/**'],
          customSets: [
            {
              label: 'Plan and markdown review workflow',
              description:
                'setup and usage docs for reviewing coding-agent plans, specs, RFCs, and other markdown documents',
              paths: [
                'quickstart',
                'install',
                'how-it-works',
                'usage',
                'usage/open',
                'usage/claude-code',
                'usage/codex',
                'usage/other-agents',
              ],
            },
            {
              label: 'CLI command reference',
              description:
                'generated command reference for contextbridge plan, contextbridge open, and harness integration commands',
              paths: ['cli/**'],
            },
          ],
          optionalLinks: [
            {
              label: 'Homepage',
              url: 'https://plan.contextbridge.ai/',
              description: 'product overview and installation entrypoint',
            },
            {
              label: 'GitHub repository',
              url: 'https://github.com/contextbridge/planbridge',
              description: 'source code, issues, and releases',
            },
          ],
          customSelectors: {
            all: ['script', 'style', 'video', 'dialog'],
          },
        }),
      ],
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
            { label: 'Plan-mode collaboration', slug: 'usage/plan-mode' },
            { label: 'Precision feedback on a file', slug: 'usage/open' },
            { label: 'Annotate last message', slug: 'usage/last' },
            { label: 'Other agents', slug: 'usage/other-agents' },
          ],
        },
        {
          label: 'Recipes',
          items: [
            { label: 'Superpowers', slug: 'recipes/superpowers' },
            { label: 'Spec Kit', slug: 'recipes/spec-kit' },
            { label: 'Spec Kitty', slug: 'recipes/spec-kitty' },
            { label: 'OpenSpec', slug: 'recipes/openspec' },
            { label: 'BMAD Method', slug: 'recipes/bmad' },
            { label: 'Agent OS', slug: 'recipes/agent-os' },
          ],
        },
        {
          label: 'About',
          items: [
            { label: 'Privacy & telemetry', slug: 'privacy' },
            { label: 'Feedback', slug: 'feedback' },
          ],
        },
        {
          label: 'Reference',
          items: [{ autogenerate: { directory: 'cli' } }],
        },
      ],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
