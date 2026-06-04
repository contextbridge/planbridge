import { getErrorMessage, toError } from '@contextbridge/shared/errors';
import type { InboxActor, InboxFilters, InboxItem, InboxSnapshot } from '@contextbridge/shared/inboxSchema';
import { inboxFiltersSchema, inboxSnapshotSchema } from '@contextbridge/shared/inboxSchema';
import { Temporal, instantToString } from '@contextbridge/shared/time';
import { Result, ResultAsync, err, ok } from 'neverthrow';
import { z } from 'zod';
import type { RunCommandResult } from '#src/CommandRunnerImpl.ts';
import type { CliContext } from '#src/context.ts';
import { type InboxItemSource, actionStateRank, deriveActionState } from './inboxActionState.ts';

export type InboxErrorCode =
  | 'gh_missing'
  | 'gh_auth'
  | 'gh_command_failed'
  | 'invalid_json'
  | 'invalid_data'
  | 'open_failed';

export interface InboxError {
  readonly code: InboxErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export interface InboxQueryOptions {
  readonly filters?: InboxFilters;
  readonly repositories?: readonly string[];
  readonly allRepos?: boolean;
}

export class GhCliInboxClient {
  private readonly ctx: CliContext;
  private readonly defaultOptions: InboxQueryOptions;

  constructor(ctx: CliContext, defaultOptions: InboxQueryOptions = {}) {
    this.ctx = ctx;
    this.defaultOptions = defaultOptions;
  }

  preflight(): ResultAsync<void, InboxError> {
    return this.ensureGhAvailable()
      .andThen(() => this.runGh(['--version']).map(() => undefined))
      .andThen(() =>
        this.runGh(['auth', 'status'])
          .map(() => undefined)
          .mapErr((error): InboxError => (error.code === 'gh_command_failed' ? { ...error, code: 'gh_auth' } : error)),
      );
  }

  getViewer(): ResultAsync<GitHubViewer, InboxError> {
    return this.ensureGhAvailable()
      .andThen(() => this.runGh(['api', 'user']))
      .andThen((result) => parseJson(result.stdout, ghViewerSchema, 'invalid GitHub viewer payload'));
  }

  getInbox(filters: InboxFilters = {}): ResultAsync<InboxSnapshot, InboxError> {
    const options = this.defaultOptions;
    const parsedFilters = inboxFiltersSchema.parse({ ...options.filters, ...withoutUndefined(filters) });

    return this.getViewer().andThen((viewer) =>
      this.resolveRepositories(options).andThen((repositories) =>
        this.fetchInbox(viewer.login, repositories).andThen((data) => {
          const normalized = [
            ...(data.reviewRequested?.nodes ?? []).map((node) =>
              normalizePrNode(node, viewer.login, 'review_requested'),
            ),
            ...(data.authored?.nodes ?? []).map((node) => normalizePrNode(node, viewer.login, 'authored')),
            ...(data.assignedIssues?.nodes ?? []).map((node) => normalizeIssueNode(node, viewer.login)),
          ];
          const items = dedupeItems(normalized.filter(isItem))
            .filter((item) => matchesFilters(item, parsedFilters))
            .sort(compareItems);

          return validateSnapshot({
            viewer: viewer.login,
            generatedAt: instantToString(Temporal.Now.instant()),
            filters: repositories.length > 0 ? { ...parsedFilters, repositories } : parsedFilters,
            items,
          });
        }),
      ),
    );
  }

  openItem(url: string): ResultAsync<void, InboxError> {
    const { openUrl } = this.ctx;
    return ResultAsync.fromPromise(openUrl(url), (cause) => ({
      code: 'open_failed',
      message: `failed to open ${url}: ${getErrorMessage(cause)}`,
      cause,
    }));
  }

  private ensureGhAvailable(): ResultAsync<void, InboxError> {
    const { commandRunner } = this.ctx;
    if (commandRunner.which('gh')) return ResultAsync.fromSafePromise(Promise.resolve());
    return ResultAsync.fromSafePromise(Promise.resolve()).andThen(() =>
      err(
        failure(
          'gh_missing',
          'GitHub CLI (`gh`) was not found. Install it and run `gh auth login` before using `contextbridge inbox`.',
        ),
      ),
    );
  }

  private resolveRepositories(options: InboxQueryOptions): ResultAsync<string[], InboxError> {
    const explicit = options.repositories ?? options.filters?.repositories ?? [];
    if (explicit.length > 0) return ResultAsync.fromSafePromise(Promise.resolve([...explicit]));
    if (options.allRepos) return ResultAsync.fromSafePromise(Promise.resolve([]));

    return this.resolveCurrentGitHubRepository().map((repository) => (repository ? [repository] : []));
  }

  private resolveCurrentGitHubRepository(): ResultAsync<string | null, InboxError> {
    const { commandRunner } = this.ctx;
    return ResultAsync.fromPromise(commandRunner.run('git', ['config', '--get', 'remote.origin.url']), (cause) =>
      commandError('gh_command_failed', 'failed to inspect git remote', cause),
    ).map((result) => (result.exitCode === 0 ? parseGitHubRemote(result.stdout.trim()) : null));
  }

  private fetchInbox(viewer: string, repositories: readonly string[]): ResultAsync<InboxGraphqlData, InboxError> {
    const { commandRunner } = this.ctx;
    const args = buildGraphqlArgs(viewer, repositories);
    return ResultAsync.fromPromise(commandRunner.run('gh', args), (cause) =>
      commandError('gh_command_failed', 'failed to query the GitHub inbox', cause),
    ).andThen((result) =>
      result.exitCode === 0
        ? parseJson(result.stdout, inboxGraphqlResponseSchema, 'invalid GitHub GraphQL inbox payload').map(
            (parsed) => parsed.data,
          )
        : err(failure('gh_command_failed', result.stderr.trim() || `gh inbox query exited with ${result.exitCode}`)),
    );
  }

  private runGh(args: readonly string[]): ResultAsync<RunCommandResult, InboxError> {
    const { commandRunner } = this.ctx;
    return ResultAsync.fromPromise(commandRunner.run('gh', args), (cause) =>
      commandError('gh_command_failed', `failed to run gh ${args.join(' ')}`, cause),
    ).andThen((result) =>
      result.exitCode === 0
        ? ok(result)
        : err(
            failure('gh_command_failed', result.stderr.trim() || `gh ${args.join(' ')} exited with ${result.exitCode}`),
          ),
    );
  }
}

export type GitHubViewer = z.infer<typeof ghViewerSchema>;

const ghViewerSchema = z.object({
  login: z.string().trim().nonempty(),
  name: z.string().trim().nonempty().nullable().optional(),
  html_url: z.string().trim().nonempty().optional(),
});

// One GraphQL round trip splits the inbox into its three lanes by search
// qualifier: PRs whose review GitHub requested of me, PRs I authored, and issues
// assigned to me. The PR nodes carry the review/CI/merge signals the old
// `gh search` payload could not, which is what the action-state classifier needs.
const INBOX_GRAPHQL_QUERY = `query ($reviewQuery: String!, $authoredQuery: String!, $issueQuery: String!) {
  reviewRequested: search(query: $reviewQuery, type: ISSUE, first: 50) { nodes { ...PrFields } }
  authored: search(query: $authoredQuery, type: ISSUE, first: 50) { nodes { ...PrFields } }
  assignedIssues: search(query: $issueQuery, type: ISSUE, first: 50) { nodes { ...IssueFields } }
}
fragment PrFields on PullRequest {
  id number title url isDraft createdAt updatedAt reviewDecision mergeable
  repository { nameWithOwner name owner { login } }
  author { login url ... on User { name } ... on Organization { name } }
  labels(first: 20) { nodes { name color } }
  assignees(first: 10) { nodes { login url name } }
  latestReviews(first: 30) { nodes { author { login } state } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
}
fragment IssueFields on Issue {
  id number title url createdAt updatedAt
  repository { nameWithOwner name owner { login } }
  author { login url ... on User { name } }
  labels(first: 20) { nodes { name color } }
  assignees(first: 10) { nodes { login url name } }
}`;

const ghActorSchema = z
  .object({ login: z.string().optional(), url: z.string().optional(), name: z.string().nullable().optional() })
  .passthrough()
  .nullable()
  .optional();

const ghRepositorySchema = z
  .object({
    nameWithOwner: z.string().optional(),
    name: z.string().optional(),
    owner: z.object({ login: z.string().optional() }).passthrough().nullable().optional(),
  })
  .passthrough();

const ghLabelsSchema = z
  .object({ nodes: z.array(z.object({ name: z.string(), color: z.string().optional() }).passthrough()).optional() })
  .nullable()
  .optional();

const ghAssigneesSchema = z
  .object({ nodes: z.array(ghActorSchema).optional() })
  .nullable()
  .optional();

const ghPrNodeSchema = z
  .object({
    id: z.string().optional(),
    number: z.number().int().positive().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    isDraft: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    reviewDecision: z.string().nullable().optional(),
    mergeable: z.string().nullable().optional(),
    repository: ghRepositorySchema.optional(),
    author: ghActorSchema,
    labels: ghLabelsSchema,
    assignees: ghAssigneesSchema,
    latestReviews: z
      .object({
        nodes: z
          .array(
            z.object({
              author: z.object({ login: z.string().optional() }).nullable().optional(),
              state: z.string().optional(),
            }),
          )
          .optional(),
      })
      .nullable()
      .optional(),
    commits: z
      .object({
        nodes: z
          .array(
            z.object({
              commit: z.object({ statusCheckRollup: z.object({ state: z.string() }).nullable().optional() }),
            }),
          )
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough()
  .nullable();

const ghIssueNodeSchema = z
  .object({
    id: z.string().optional(),
    number: z.number().int().positive().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    repository: ghRepositorySchema.optional(),
    author: ghActorSchema,
    labels: ghLabelsSchema,
    assignees: ghAssigneesSchema,
  })
  .passthrough()
  .nullable();

const inboxGraphqlResponseSchema = z
  .object({
    data: z.object({
      reviewRequested: z
        .object({ nodes: z.array(ghPrNodeSchema).optional() })
        .nullable()
        .optional(),
      authored: z
        .object({ nodes: z.array(ghPrNodeSchema).optional() })
        .nullable()
        .optional(),
      assignedIssues: z
        .object({ nodes: z.array(ghIssueNodeSchema).optional() })
        .nullable()
        .optional(),
    }),
  })
  .passthrough();

type InboxGraphqlData = z.infer<typeof inboxGraphqlResponseSchema>['data'];
type GhPrNode = z.infer<typeof ghPrNodeSchema>;
type GhIssueNode = z.infer<typeof ghIssueNodeSchema>;

function buildGraphqlArgs(viewer: string, repositories: readonly string[]): string[] {
  const repoScope = repositories.map((repository) => `repo:${repository}`).join(' ');
  const suffix = repoScope ? ` ${repoScope}` : '';
  return [
    'api',
    'graphql',
    '-f',
    `query=${INBOX_GRAPHQL_QUERY}`,
    '-f',
    `reviewQuery=is:open is:pr review-requested:${viewer}${suffix}`,
    '-f',
    `authoredQuery=is:open is:pr author:${viewer}${suffix}`,
    '-f',
    `issueQuery=is:open is:issue assignee:${viewer}${suffix}`,
  ];
}

function normalizePrNode(node: GhPrNode, viewerLogin: string, source: InboxItemSource): InboxItem | null {
  if (!node || !node.url || !node.number || !node.title || !node.createdAt || !node.updatedAt) return null;

  const repository = normalizeRepository(node.repository);
  const isDraft = node.isDraft ?? false;
  const checksState = node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? undefined;
  const viewerHasApproved = (node.latestReviews?.nodes ?? []).some(
    (review) => review.author?.login === viewerLogin && review.state === 'APPROVED',
  );
  const actionState = deriveActionState({
    kind: 'pull_request',
    source,
    isDraft,
    reviewDecision: node.reviewDecision ?? undefined,
    viewerHasApproved,
    checksState,
    mergeable: node.mergeable ?? undefined,
  });

  return {
    id: node.id ?? node.url,
    nodeId: node.id ?? node.url,
    number: node.number,
    kind: 'pull_request',
    title: node.title,
    url: node.url,
    repository: repository.name,
    owner: repository.owner,
    state: isDraft ? 'draft' : 'open',
    isDraft,
    author: normalizeActor(node.author),
    assignees: (node.assignees?.nodes ?? []).map((actor) => normalizeActor(actor)),
    labels: normalizeLabels(node.labels),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    lastActivityAt: node.updatedAt,
    reviewDecision: node.reviewDecision ?? undefined,
    checksConclusion: checksState,
    actionState,
  };
}

function normalizeIssueNode(node: GhIssueNode, _viewerLogin: string): InboxItem | null {
  if (!node || !node.url || !node.number || !node.title || !node.createdAt || !node.updatedAt) return null;

  const repository = normalizeRepository(node.repository);
  return {
    id: node.id ?? node.url,
    nodeId: node.id ?? node.url,
    number: node.number,
    kind: 'issue',
    title: node.title,
    url: node.url,
    repository: repository.name,
    owner: repository.owner,
    state: 'open',
    isDraft: false,
    author: normalizeActor(node.author),
    assignees: (node.assignees?.nodes ?? []).map((actor) => normalizeActor(actor)),
    labels: normalizeLabels(node.labels),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    lastActivityAt: node.updatedAt,
    actionState: 'assigned_issue',
  };
}

function validateSnapshot(snapshot: InboxSnapshot): Result<InboxSnapshot, InboxError> {
  const parsed = inboxSnapshotSchema.safeParse(snapshot);
  return parsed.success
    ? ok(parsed.data)
    : err({
        code: 'invalid_data',
        message: 'normalized inbox snapshot did not match the shared schema',
        cause: parsed.error,
      });
}

function matchesFilters(item: InboxItem, filters: InboxFilters): boolean {
  const { repositories, kinds, includeDrafts = false, includeDependabot = false } = filters;
  if (
    repositories &&
    !repositories.includes(`${item.owner}/${item.repository}`) &&
    !repositories.includes(item.repository)
  )
    return false;
  if (kinds && !kinds.includes(item.kind)) return false;
  if (!includeDrafts && item.isDraft) return false;
  if (!includeDependabot && isDependabot(item.author.login)) return false;
  return true;
}

function dedupeItems(items: readonly InboxItem[]): InboxItem[] {
  const seen = new Set<string>();
  const deduped: InboxItem[] = [];
  for (const item of items) {
    const key = item.nodeId || item.url;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

// Sort by action urgency first; within "needs my review" surface the oldest
// request (longest someone has been blocked), otherwise most recent activity.
function compareItems(a: InboxItem, b: InboxItem): number {
  const rankDelta = actionStateRank(a.actionState) - actionStateRank(b.actionState);
  if (rankDelta !== 0) return rankDelta;
  if (a.actionState === 'needs_my_review') {
    return Temporal.Instant.compare(Temporal.Instant.from(a.createdAt), Temporal.Instant.from(b.createdAt));
  }
  return Temporal.Instant.compare(Temporal.Instant.from(b.updatedAt), Temporal.Instant.from(a.updatedAt));
}

function isItem(item: InboxItem | null): item is InboxItem {
  return item !== null;
}

function isDependabot(login: string): boolean {
  return login === 'dependabot' || login === 'dependabot[bot]';
}

type GhActor = z.infer<typeof ghActorSchema>;
type GhRepository = z.infer<typeof ghRepositorySchema>;
type GhLabels = z.infer<typeof ghLabelsSchema>;

function normalizeActor(actor: GhActor): InboxActor {
  return {
    login: actor?.login ?? 'unknown',
    name: actor?.name ?? undefined,
    url: actor?.url,
  };
}

function normalizeRepository(repository: GhRepository | undefined): { name: string; owner: string } {
  const owner = repository?.owner?.login;
  if (repository?.nameWithOwner) {
    const [nameOwner = owner ?? 'unknown', name = repository.name ?? repository.nameWithOwner] =
      repository.nameWithOwner.split('/');
    return { owner: nameOwner, name };
  }
  return { owner: owner ?? 'unknown', name: repository?.name ?? 'unknown' };
}

function normalizeLabels(labels: GhLabels): InboxItem['labels'] {
  return labels?.nodes
    ?.map((label) => ({ name: label.name, color: label.color }))
    .filter((label) => label.name.length > 0);
}

function parseGitHubRemote(remote: string): string | null {
  const httpsMatch = /^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/.exec(remote);
  if (httpsMatch) return httpsMatch[1] ?? null;
  const sshMatch = /^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/.exec(remote);
  return sshMatch?.[1] ?? null;
}

function parseJson<T>(text: string, schema: z.ZodSchema<T>, message: string): Result<T, InboxError> {
  const parsedJson = Result.fromThrowable(() => JSON.parse(text) as unknown, toError)();
  if (parsedJson.isErr()) return err({ code: 'invalid_json', message, cause: parsedJson.error });
  const parsedSchema = schema.safeParse(parsedJson.value);
  return parsedSchema.success
    ? ok(parsedSchema.data)
    : err({ code: 'invalid_data', message, cause: parsedSchema.error });
}

function commandError(code: InboxErrorCode, message: string, cause: unknown): InboxError {
  return { code, message: `${message}: ${getErrorMessage(cause)}`, cause };
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as Partial<T>;
}

function failure(code: InboxErrorCode, message: string): InboxError {
  return { code, message };
}
