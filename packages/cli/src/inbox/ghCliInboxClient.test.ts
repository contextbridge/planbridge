import { describe, expect, it } from 'bun:test';
import { createStubContext } from '#src/testHelpers/index.ts';
import { GhCliInboxClient } from './ghCliInboxClient.ts';

describe('GhCliInboxClient', () => {
  it('maps gh search results into a prioritized deduped snapshot', async () => {
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich('gh', '/usr/bin/gh');
    commandRunner.on('gh', ['api', 'user']).resolves({ stdout: JSON.stringify({ login: 'octocat' }) });
    commandRunner.on('gh', ['search', 'prs']).resolves({
      stdout: JSON.stringify([
        rawPr({
          id: '1',
          number: 1,
          reviewRequests: [{ login: 'octocat' }],
          assignees: [{ login: 'octocat' }],
        }),
      ]),
    });
    commandRunner
      .on('gh', ['search', 'issues'])
      .resolves({ stdout: JSON.stringify([rawIssue({ id: '2', number: 2 })]) });

    const result = await new GhCliInboxClient(context, { allRepos: true }).getInbox({ includeDependabot: true });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.items).toHaveLength(2);
    expect(result.value.items[0]).toMatchObject({ number: 1, kind: 'pull_request', priority: 'urgent' });
    expect(commandRunner.callsTo('gh', ['search', 'prs'])).toHaveLength(2);
    expect(commandRunner.callsTo('gh', ['search', 'issues'])).toHaveLength(1);
  });

  it('maps missing gh to an actionable preflight error', async () => {
    const { context } = createStubContext();

    const result = await new GhCliInboxClient(context).preflight();

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error).toMatchObject({ code: 'gh_missing' });
  });

  it('uses explicit repository scope in search calls', async () => {
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich('gh', '/usr/bin/gh');
    commandRunner.on('gh', ['api', 'user']).resolves({ stdout: JSON.stringify({ login: 'octocat' }) });
    commandRunner.on('gh', ['search', 'prs']).resolves({ stdout: '[]' });
    commandRunner.on('gh', ['search', 'issues']).resolves({ stdout: '[]' });

    const result = await new GhCliInboxClient(context, { repositories: ['contextbridge/example'] }).getInbox();

    expect(result.isOk()).toBe(true);
    expect(commandRunner.callsTo('gh', ['search', 'prs'])[0]?.args).toContain('--repo');
    expect(commandRunner.callsTo('gh', ['search', 'prs'])[0]?.args).toContain('contextbridge/example');
  });
});

function rawPr(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '1',
    number: 1,
    title: 'Review me',
    url: 'https://github.com/contextbridge/example/pull/1',
    repository: 'contextbridge/example',
    author: { login: 'alice' },
    assignees: [],
    reviewRequests: [],
    labels: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    isDraft: false,
    state: 'open',
    ...overrides,
  };
}

function rawIssue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '2',
    number: 2,
    title: 'Assigned issue',
    url: 'https://github.com/contextbridge/example/issues/2',
    repository: 'contextbridge/example',
    author: { login: 'bob' },
    assignees: [{ login: 'octocat' }],
    labels: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    state: 'open',
    ...overrides,
  };
}
