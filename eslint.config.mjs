import baseConfig from '@contextbridge-ai/eslint-config/base';
import { defineConfig } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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

const consoleRestrictedSelector = {
  selector: "CallExpression[callee.object.name='console']",
  message:
    'Do not use console.* — use ctx.logger for diagnostics (writes to stderr) and ctx.io.stdout for business output.',
};

const processRestrictedProperties = [
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
];

const annotationBrowserWindowRestrictedProperties = [
  {
    object: 'window',
    property: 'close',
    message: 'Use browser.closeWindow() from AnnotationAppContext instead of window.close().',
  },
  {
    object: 'window',
    property: 'setTimeout',
    message: 'Use browser.scheduleTimeout() from AnnotationAppContext instead of window.setTimeout().',
  },
  {
    object: 'window',
    property: 'clearTimeout',
    message: 'Use the cancel callback returned by browser.scheduleTimeout() instead of window.clearTimeout().',
  },
  {
    object: 'window',
    property: 'onbeforeunload',
    message: 'Use browser.addBeforeUnloadGuard() from AnnotationAppContext instead of window.onbeforeunload.',
  },
];

const annotationBrowserWindowRestrictedSelectors = [
  {
    selector:
      "CallExpression[callee.object.name='window'][callee.property.name=/^(addEventListener|removeEventListener)$/][arguments.0.value='beforeunload']",
    message: 'Use browser.addBeforeUnloadGuard() from AnnotationAppContext instead of direct beforeunload listeners.',
  },
];

const rawImgRestrictedSelector = {
  selector: "JSXOpeningElement[name.name='img']",
  message:
    "Use <Image /> or <Picture /> from astro:assets, and import images from src/assets/. Raw <img> bypasses Astro's asset pipeline.",
};

export default defineConfig(
  ...baseConfig,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
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
      'no-restricted-syntax': ['error', ...dateRestrictedSelectors, consoleRestrictedSelector],
      'no-restricted-properties': ['error', ...processRestrictedProperties],
    },
  },
  {
    files: ['packages/annotation/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...dateRestrictedSelectors,
        consoleRestrictedSelector,
        ...annotationBrowserWindowRestrictedSelectors,
      ],
      'no-restricted-properties': [
        'error',
        ...processRestrictedProperties,
        ...annotationBrowserWindowRestrictedProperties,
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
  {
    files: ['packages/website/**/*.astro'],
    extends: [astro.configs['flat/recommended']],
  },
  {
    files: ['**/*.astro'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['packages/website/src/**/*.{astro,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...dateRestrictedSelectors, rawImgRestrictedSelector],
    },
  },
);
