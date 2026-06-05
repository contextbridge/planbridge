import { describe, expect, it } from 'bun:test';
import { createStubContext } from '#src/testHelpers/index.ts';
import { GhCliInboxClient, type GhCliInboxClientDeps } from './ghCliInboxClient.ts';
import type { GitHubGraphqlClient } from './githubGraphqlClient.ts';

describe('GhCliInboxClient', () => {
  it('classifies GraphQL results into action states in a single query', async () => {
    const { context, commandRunner } = createStubContext();
    stubGhAuth(commandRunner);
    const { deps, graphql } = fakeGraphql(
      dataPayload({
        reviewRequested: [prNode({ number: 1, author: 'alice', reviewDecision: 'REVIEW_REQUIRED' })],
        authored: [prNode({ number: 3, author: 'octocat', reviewDecision: 'CHANGES_REQUESTED' })],
        assignedIssues: [issueNode({ number: 2 })],
      }),
    );

    const result = await new GhCliInboxClient(context, { allRepos: true }, deps).getInbox();

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const byNumber = new Map(result.value.items.map((item) => [item.number, item]));
    expect(byNumber.get(1)).toMatchObject({ kind: 'pull_request', actionState: 'needs_my_review' });
    expect(byNumber.get(3)).toMatchObject({ kind: 'pull_request', actionState: 'changes_requested' });
    expect(byNumber.get(2)).toMatchObject({ kind: 'issue', actionState: 'assigned_issue' });
    expect(graphql.calls).toHaveLength(1);
  });

  it('drops a review-requested PR a co-owner already approved', async () => {
    const { context, commandRunner } = createStubContext();
    stubGhAuth(commandRunner);
    const { deps } = fakeGraphql(
      dataPayload({ reviewRequested: [prNode({ number: 5, author: 'alice', reviewDecision: 'APPROVED' })] }),
    );

    const result = await new GhCliInboxClient(context, { allRepos: true }, deps).getInbox();

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

  it('drops items from archived repositories', async () => {
    const { context, commandRunner } = createStubContext();
    stubGhAuth(commandRunner);
    const { deps } = fakeGraphql(
      dataPayload({
        reviewRequested: [
          prNode({ number: 1, author: 'alice', reviewDecision: 'REVIEW_REQUIRED' }),
          prNode({ number: 9, author: 'alice', reviewDecision: 'REVIEW_REQUIRED', archived: true }),
        ],
        assignedIssues: [issueNode({ number: 7, archived: true })],
      }),
    );

    const result = await new GhCliInboxClient(context, { allRepos: true }, deps).getInbox();

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.items.map((item) => item.number)).toEqual([1]);
  });

  it('scopes the GraphQL search to explicit repositories', async () => {
    const { context, commandRunner } = createStubContext();
    stubGhAuth(commandRunner);
    const { deps, graphql } = fakeGraphql(dataPayload({}));

    const result = await new GhCliInboxClient(context, { repositories: ['contextbridge/example'] }, deps).getInbox();

    expect(result.isOk()).toBe(true);
    const variables = graphql.calls[0]?.variables ?? {};
    expect(String(variables.reviewQuery)).toContain('repo:contextbridge/example');
    expect(String(variables.authoredQuery)).toContain('repo:contextbridge/example');
  });
});

interface DataPayloadNodes {
  readonly reviewRequested?: unknown[];
  readonly authored?: unknown[];
  readonly assignedIssues?: unknown[];
}

interface GraphqlCall {
  readonly query: string;
  readonly variables: Record<string, unknown>;
}

function stubGhAuth(commandRunner: ReturnType<typeof createStubContext>['commandRunner']): void {
  commandRunner.setWhich('gh', '/usr/bin/gh');
  commandRunner.on('gh', ['auth', 'token']).resolves({ stdout: 'gho_testtoken\n' });
}

function fakeGraphql(payload: Record<string, unknown>): {
  deps: GhCliInboxClientDeps;
  graphql: { calls: GraphqlCall[] };
} {
  const calls: GraphqlCall[] = [];
  const client: GitHubGraphqlClient = {
    graphql: <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
      calls.push({ query, variables });
      return Promise.resolve(payload as T);
    },
  };
  return { deps: { createGraphqlClient: () => client }, graphql: { calls } };
}

function dataPayload({
  reviewRequested = [],
  authored = [],
  assignedIssues = [],
}: DataPayloadNodes): Record<string, unknown> {
  return {
    viewer: { login: 'octocat' },
    reviewRequested: { nodes: reviewRequested },
    authored: { nodes: authored },
    assignedIssues: { nodes: assignedIssues },
  };
}

function prNode(over: {
  number: number;
  author: string;
  reviewDecision?: string;
  archived?: boolean;
}): Record<string, unknown> {
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
    repository: {
      nameWithOwner: 'contextbridge/example',
      name: 'example',
      isArchived: over.archived ?? false,
      owner: { login: 'contextbridge' },
    },
    author: { login: over.author },
    labels: { nodes: [] },
    assignees: { nodes: [] },
    latestReviews: { nodes: [] },
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
  };
}

function issueNode(over: { number: number; archived?: boolean }): Record<string, unknown> {
  return {
    id: `I_${over.number}`,
    number: over.number,
    title: `Issue ${over.number}`,
    url: `https://github.com/contextbridge/example/issues/${over.number}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    repository: {
      nameWithOwner: 'contextbridge/example',
      name: 'example',
      isArchived: over.archived ?? false,
      owner: { login: 'contextbridge' },
    },
    author: { login: 'bob' },
    labels: { nodes: [] },
    assignees: { nodes: [{ login: 'octocat' }] },
  };
}
