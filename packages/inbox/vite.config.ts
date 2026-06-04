import { cbBuildDefinesFromEnv } from '@contextbridge/context/build';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => ({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
    viteSingleFile(),
    command === 'serve' ? mockInboxApi() : null,
  ],
  define: cbBuildDefinesFromEnv(),
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
  server: {
    proxy: process.env.INBOX_API_PORT ? { '/api': `http://localhost:${process.env.INBOX_API_PORT}` } : undefined,
  },
}));

/**
 * Vite dev-server plugin that serves mock inbox API responses when no real
 * backend is available. Active only during `vite dev` (command === 'serve'),
 * not in the production build.
 *
 * To use a real backend instead, set `INBOX_API_PORT` to the port where
 * `contextbridge inbox` is running — the `server.proxy` config above will
 * forward `/api/*` requests there and this plugin is skipped.
 */
function mockInboxApi(): Plugin {
  return {
    name: 'mock-inbox-api',
    configureServer(server) {
      server.middlewares.use('/api/inbox/snapshot', (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(mockSnapshot));
      });

      server.middlewares.use('/api/inbox/open', (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ opened: true }));
      });
    },
  };
}

const mockSnapshot = {
  viewer: 'you',
  generatedAt: '2026-06-04T00:00:00Z',
  filters: {},
  items: [
    {
      id: 'mock-1',
      nodeId: 'mock-node-1',
      number: 142,
      kind: 'pull_request',
      title: 'Fix auth handler crash on expired tokens',
      url: 'https://github.com/your-org/your-repo/pull/142',
      repository: 'your-repo',
      owner: 'your-org',
      state: 'open',
      isDraft: false,
      author: { login: 'teammate' },
      assignees: [{ login: 'you' }],
      reviewRequests: [{ login: 'you' }],
      labels: [{ name: 'bug', color: 'ff0000' }],
      createdAt: '2026-05-28T10:00:00Z',
      updatedAt: '2026-06-03T14:30:00Z',
      priority: 'urgent',
      priorityScore: 180,
      reasons: ['review_requested', 'ci_failing'],
      checksConclusion: 'FAILURE',
    },
    {
      id: 'mock-2',
      nodeId: 'mock-node-2',
      number: 98,
      kind: 'pull_request',
      title: 'Refactor database connection pooling',
      url: 'https://github.com/your-org/your-repo/pull/98',
      repository: 'your-repo',
      owner: 'your-org',
      state: 'open',
      isDraft: false,
      author: { login: 'contributor' },
      reviewRequests: [{ login: 'you' }],
      labels: [{ name: 'enhancement' }],
      createdAt: '2026-05-20T08:00:00Z',
      updatedAt: '2026-06-01T12:00:00Z',
      priority: 'high',
      priorityScore: 100,
      reasons: ['review_requested'],
    },
    {
      id: 'mock-3',
      nodeId: 'mock-node-3',
      number: 55,
      kind: 'issue',
      title: 'Investigate slow query performance on dashboard',
      url: 'https://github.com/your-org/other-repo/issues/55',
      repository: 'other-repo',
      owner: 'your-org',
      state: 'open',
      isDraft: false,
      author: { login: 'pm' },
      assignees: [{ login: 'you' }],
      labels: [{ name: 'performance' }],
      createdAt: '2026-05-15T09:00:00Z',
      updatedAt: '2026-05-30T16:00:00Z',
      priority: 'normal',
      priorityScore: 80,
      reasons: ['assigned_to_me'],
    },
    {
      id: 'mock-4',
      nodeId: 'mock-node-4',
      number: 201,
      kind: 'pull_request',
      title: 'Bump eslint from 9.0.0 to 9.1.0',
      url: 'https://github.com/your-org/your-repo/pull/201',
      repository: 'your-repo',
      owner: 'your-org',
      state: 'open',
      isDraft: false,
      author: { login: 'dependabot[bot]' },
      labels: [{ name: 'dependencies' }],
      createdAt: '2026-06-01T06:00:00Z',
      updatedAt: '2026-06-01T06:00:00Z',
      priority: 'low',
      priorityScore: -30,
      reasons: ['dependabot'],
    },
  ],
};
