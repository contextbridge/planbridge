import baseConfig from '@contextbridge-ai/eslint-config/base';
import { defineConfig } from 'eslint/config';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const reactFiles = ['packages/annotation/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'];

// Flat-config array-valued rules (like no-restricted-syntax) are REPLACED, not
// merged, when a later matching block sets the same rule. Keep the shared
// selectors here so scoped blocks can include them alongside their own.
const dateRestrictedSelectors = [
  {
    selector: 'NewExpression[callee.name="Date"]',
    message: 'Use Temporal from @contextbridge/shared/time instead of Date.',
  },
  {
    selector: 'CallExpression[callee.name="Date"]',
    message: 'Use Temporal from @contextbridge/shared/time instead of Date.',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
    message: 'Use Temporal from @contextbridge/shared/time instead of Date.now().',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="parse"]',
    message: 'Use Temporal from @contextbridge/shared/time instead of Date.parse().',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="UTC"]',
    message: 'Use Temporal from @contextbridge/shared/time instead of Date.UTC().',
  },
];

export default defineConfig(
  ...baseConfig,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'tools/**',
      'packages/*/dist/**',
      'packages/*/node_modules/**',
      'packages/*/.astro/**',
      'packages/*/storybook-static/**',
      '**/*.stories.{ts,tsx}',
    ],
  },
  {
    rules: {
      'no-restricted-syntax': ['error', ...dateRestrictedSelectors],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@anthropic-ai/claude-agent-sdk',
              message: 'Import types only from @anthropic-ai/claude-agent-sdk — we do not use the full SDK at runtime.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...dateRestrictedSelectors,
        {
          selector: "CallExpression[callee.object.name='console']",
          message:
            'Do not use console.* — use ctx.logger for diagnostics (writes to stderr) and ctx.io.stdout for business output.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'stdout',
          message: 'Use ctx.io.stdout (see AGENTS.md DI conventions).',
        },
        {
          object: 'process',
          property: 'stderr',
          message: 'Use ctx.io.stderr / ctx.logger (see AGENTS.md DI conventions).',
        },
        {
          object: 'process',
          property: 'stdin',
          message: 'Use ctx.io.stdin (see AGENTS.md DI conventions).',
        },
      ],
    },
  },
  {
    files: reactFiles,
    extends: [react.configs.flat.recommended, react.configs.flat['jsx-runtime']],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: '19.2',
      },
    },
    rules: {
      'react/prop-types': 'off',
    },
  },
  {
    files: reactFiles,
    extends: [reactHooks.configs.flat.recommended],
  },
);
