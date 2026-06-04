import { describe, expect, it } from 'bun:test';
import { createStubContext } from '#src/testHelpers/index.ts';
import { GhCliInboxClient } from './ghCliInboxClient.ts';

describe('GhCliInboxClient', () => {
  it('classifies GraphQL results into action states in a single query', async () => {
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich('gh', '/usr/bin/gh');
    commandRunner.on('gh', ['api', 'user']).resolves({ stdout: JSON.stringify({ login: 'octocat' }) });
    commandRunner.on('gh', ['api', 'graphql']).resolves({
      stdout: JSON.stringify(
        envelope({
          reviewRequested: [prNode({ number: 1, author: 'alice', reviewDecision: 'REVIEW_REQUIRED' })],
          authored: [prNode({ number: 3, author: 'octocat', reviewDecision: 'CHANGES_REQUESTED' })],
          assignedIssues: [issueNode({ number: 2 })],
        }),
      ),
    });

    const result = await new GhCliInboxClient(context, { allRepos: true }).getInbox();

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const byNumber = new Map(result.value.items.map((item) => [item.number, item]));
    expect(byNumber.get(1)).toMatchObject({ kind: 'pull_request', actionState: 'needs_my_review' });
    expect(byNumber.get(3)).toMatchObject({ kind: 'pull_request', actionState: 'changes_requested' });
    expect(byNumber.get(2)).toMatchObject({ kind: 'issue', actionState: 'assigned_issue' });
    expect(commandRunner.callsTo('gh', ['api', 'graphql'])).toHaveLength(1);
  });

  it('drops a review-requested PR a co-owner already approved', async () => {
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich('gh', '/usr/bin/gh');
    commandRunner.on('gh', ['api', 'user']).resolves({ stdout: JSON.stringify({ login: 'octocat' }) });
    commandRunner.on('gh', ['api', 'graphql']).resolves({
      stdout: JSON.stringify(
        envelope({ reviewRequested: [prNode({ number: 5, author: 'alice', reviewDecision: 'APPROVED' })] }),
      ),
    });

    const result = await new GhCliInboxClient(context, { allRepos: true }).getInbox();

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    // Still present, but parked in the quiet lane rather than "needs my review".
    expect(result.value.items[0]).toMatchObject({ number: 5, actionState: 'waiting_on_others' });
  });

  it('maps missing gh to an actionable preflight error', async () => {
    const { context } = createStubContext();

    const result = await new GhCliInboxClient(context).preflight();

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error).toMatchObject({ code: 'gh_missing' });
  });

  it('scopes the GraphQL search to explicit repositories', async () => {
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich('gh', '/usr/bin/gh');
    commandRunner.on('gh', ['api', 'user']).resolves({ stdout: JSON.stringify({ login: 'octocat' }) });
    commandRunner.on('gh', ['api', 'graphql']).resolves({ stdout: JSON.stringify(envelope({})) });

    const result = await new GhCliInboxClient(context, { repositories: ['contextbridge/example'] }).getInbox();

    expect(result.isOk()).toBe(true);
    const args = commandRunner.callsTo('gh', ['api', 'graphql'])[0]?.args ?? [];
    expect(args.some((arg) => arg.includes('repo:contextbridge/example'))).toBe(true);
  });
});

interface EnvelopeNodes {
  readonly reviewRequested?: unknown[];
  readonly authored?: unknown[];
  readonly assignedIssues?: unknown[];
}

function envelope({
  reviewRequested = [],
  authored = [],
  assignedIssues = [],
}: EnvelopeNodes): Record<string, unknown> {
  return {
    data: {
      reviewRequested: { nodes: reviewRequested },
      authored: { nodes: authored },
      assignedIssues: { nodes: assignedIssues },
    },
  };
}

function prNode(over: { number: number; author: string; reviewDecision?: string }): Record<string, unknown> {
  return {
    id: `PR_${over.number}`,
    number: over.number,
    title: `Pull request ${over.number}`,
    url: `https://github.com/contextbridge/example/pull/${over.number}`,
    isDraft: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    reviewDecision: over.reviewDecision ?? null,
    mergeable: 'MERGEABLE',
    repository: { nameWithOwner: 'contextbridge/example', name: 'example', owner: { login: 'contextbridge' } },
    author: { login: over.author },
    labels: { nodes: [] },
    assignees: { nodes: [] },
    latestReviews: { nodes: [] },
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
  };
}

function issueNode(over: { number: number }): Record<string, unknown> {
  return {
    id: `I_${over.number}`,
    number: over.number,
    title: `Issue ${over.number}`,
    url: `https://github.com/contextbridge/example/issues/${over.number}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    repository: { nameWithOwner: 'contextbridge/example', name: 'example', owner: { login: 'contextbridge' } },
    author: { login: 'bob' },
    labels: { nodes: [] },
    assignees: { nodes: [{ login: 'octocat' }] },
  };
}
