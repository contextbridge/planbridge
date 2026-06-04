import { getErrorMessage, toError } from '@contextbridge/shared/errors';
import type {
  InboxActor,
  InboxFilters,
  InboxItem,
  InboxSnapshot,
  InboxTimeWindow,
} from '@contextbridge/shared/inboxSchema';
import { inboxFiltersSchema, inboxSnapshotSchema } from '@contextbridge/shared/inboxSchema';
import { Temporal, instantToString } from '@contextbridge/shared/time';
import { Result, ResultAsync, err, ok } from 'neverthrow';
import { z } from 'zod';
import type { RunCommandResult } from '#src/CommandRunnerImpl.ts';
import type { CliContext } from '#src/context.ts';
import { scoreInboxItem } from './inboxPriority.ts';

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
        ResultAsync.combine([
          this.searchItems('review_requested', viewer.login, repositories, parsedFilters),
          this.searchItems('assigned_prs', viewer.login, repositories, parsedFilters),
          this.searchItems('assigned_issues', viewer.login, repositories, parsedFilters),
        ]).andThen((groups) => {
          const items = groups
            .flat()
            .map((item) => normalizeItem(item, viewer.login))
            .filter((item) => matchesFilters(item, parsedFilters))
            .sort(compareItems);

          return validateSnapshot({
            viewer: viewer.login,
            generatedAt: instantToString(Temporal.Now.instant()),
            filters: repositories.length > 0 ? { ...parsedFilters, repositories } : parsedFilters,
            items: dedupeItems(items),
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

  private searchItems(
    queryKind: 'review_requested' | 'assigned_prs' | 'assigned_issues',
    viewer: string,
    repositories: readonly string[],
    filters: InboxFilters,
  ): ResultAsync<RawSearchItem[], InboxError> {
    const { commandRunner } = this.ctx;
    const args = buildSearchArgs(queryKind, viewer, repositories, filters.timeWindow);
    return ResultAsync.fromPromise(commandRunner.run('gh', args), (cause) =>
      commandError('gh_command_failed', `failed to run gh ${args.join(' ')}`, cause),
    ).andThen((result) =>
      result.exitCode === 0
        ? parseJson(result.stdout, rawSearchItemsSchema, `invalid GitHub search payload for ${queryKind}`)
        : err(
            failure('gh_command_failed', result.stderr.trim() || `gh ${args.join(' ')} exited with ${result.exitCode}`),
          ),
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

const rawActorSchema = z
  .object({
    login: z.string().trim().nonempty().optional(),
    name: z.string().trim().nonempty().nullable().optional(),
    url: z.string().trim().nonempty().optional(),
  })
  .passthrough();

const rawRepositorySchema = z.union([
  z.string().trim().nonempty(),
  z
    .object({
      nameWithOwner: z.string().trim().nonempty().optional(),
      name: z.string().trim().nonempty().optional(),
      owner: z.union([z.string().trim().nonempty(), rawActorSchema]).optional(),
    })
    .passthrough(),
]);

const rawSearchItemSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    nodeId: z.string().optional(),
    number: z.number().int().positive(),
    title: z.string().trim().nonempty(),
    url: z.string().trim().nonempty(),
    repository: rawRepositorySchema,
    author: rawActorSchema.optional(),
    assignees: z.array(rawActorSchema).optional(),
    reviewRequests: z.array(rawActorSchema).optional(),
    labels: z
      .array(z.object({ name: z.string().trim().nonempty(), color: z.string().optional() }).passthrough())
      .optional(),
    createdAt: z.string().trim().nonempty(),
    updatedAt: z.string().trim().nonempty(),
    isDraft: z.boolean().optional(),
    state: z.string().trim().nonempty().optional(),
    baseRefName: z.string().optional(),
    headRefName: z.string().optional(),
    reviewDecision: z.string().nullable().optional(),
    checksConclusion: z.string().nullable().optional(),
  })
  .passthrough();

const rawSearchItemsSchema = z.array(rawSearchItemSchema);
type RawSearchItem = z.infer<typeof rawSearchItemSchema>;

function buildSearchArgs(
  queryKind: 'review_requested' | 'assigned_prs' | 'assigned_issues',
  viewer: string,
  repositories: readonly string[],
  timeWindow: InboxTimeWindow | undefined,
): string[] {
  const isIssueQuery = queryKind === 'assigned_issues';
  const args = [
    'search',
    isIssueQuery ? 'issues' : 'prs',
    '--state',
    'open',
    '--limit',
    '100',
    '--json',
    searchFields(isIssueQuery),
  ];

  if (queryKind === 'review_requested') args.push('--review-requested', viewer);
  if (queryKind !== 'review_requested') args.push('--assignee', viewer);
  for (const repository of repositories) args.push('--repo', repository);
  for (const searchToken of timeWindowSearchTokens(timeWindow)) args.push(searchToken);

  return args;
}

function searchFields(isIssueQuery: boolean): string {
  const fields = [
    'assignees',
    'author',
    'createdAt',
    'id',
    'labels',
    'number',
    'repository',
    'state',
    'title',
    'updatedAt',
    'url',
  ];
  if (!isIssueQuery) fields.push('isDraft');
  return fields.join(',');
}

function normalizeItem(raw: RawSearchItem, viewerLogin: string): InboxItem {
  const repository = normalizeRepository(raw.repository);
  const author = normalizeActor(raw.author, 'unknown');
  const assignees = raw.assignees?.map((actor) => normalizeActor(actor, 'unknown')) ?? [];
  const reviewRequests = raw.reviewRequests?.map((actor) => normalizeActor(actor, 'unknown')) ?? [];
  const isPr = raw.url.includes('/pull/');
  const isDraft = raw.isDraft ?? false;
  const state = isDraft ? 'draft' : normalizeState(raw.state);
  const priority = scoreInboxItem({
    kind: isPr ? 'pull_request' : 'issue',
    isDraft,
    authorLogin: author.login,
    viewerLogin,
    assigneeLogins: assignees.map((actor) => actor.login),
    reviewRequestLogins: reviewRequests.map((actor) => actor.login),
    updatedAt: raw.updatedAt,
    checksConclusion: raw.checksConclusion ?? undefined,
  });

  return {
    id: String(raw.id ?? raw.nodeId ?? raw.url),
    nodeId: raw.nodeId ?? String(raw.id ?? raw.url),
    number: raw.number,
    kind: isPr ? 'pull_request' : 'issue',
    title: raw.title,
    url: raw.url,
    repository: repository.name,
    owner: repository.owner,
    state,
    isDraft,
    author,
    assignees,
    reviewRequests,
    labels: raw.labels
      ?.map((label) => ({ name: label.name, color: label.color }))
      .filter((label) => label.name.length > 0),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastActivityAt: raw.updatedAt,
    baseRefName: raw.baseRefName,
    headRefName: raw.headRefName,
    reviewDecision: raw.reviewDecision ?? undefined,
    checksConclusion: raw.checksConclusion ?? undefined,
    priority: priority.priority,
    priorityScore: priority.priorityScore,
    reasons: [...priority.reasons],
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
  if (!includeDependabot && item.reasons.includes('dependabot')) return false;
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

function compareItems(a: InboxItem, b: InboxItem): number {
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  return Temporal.Instant.compare(Temporal.Instant.from(b.updatedAt), Temporal.Instant.from(a.updatedAt));
}

function normalizeActor(actor: RawSearchItem['author'], fallback: string): InboxActor {
  return {
    login: actor?.login ?? fallback,
    name: actor?.name ?? undefined,
    url: actor?.url,
  };
}

function normalizeRepository(repository: RawSearchItem['repository']): { name: string; owner: string } {
  if (typeof repository === 'string') {
    const [owner = 'unknown', name = repository] = repository.split('/');
    return { owner, name };
  }

  const owner = typeof repository.owner === 'string' ? repository.owner : repository.owner?.login;
  if (repository.nameWithOwner) {
    const [nameOwner = owner ?? 'unknown', name = repository.name ?? repository.nameWithOwner] =
      repository.nameWithOwner.split('/');
    return { owner: nameOwner, name };
  }

  return { owner: owner ?? 'unknown', name: repository.name ?? 'unknown' };
}

function normalizeState(state: string | undefined): InboxItem['state'] {
  const normalized = state?.toLowerCase();
  if (normalized === 'merged') return 'merged';
  if (normalized === 'closed') return 'closed';
  return 'open';
}

function timeWindowSearchTokens(timeWindow: InboxTimeWindow | undefined): string[] {
  const now = Temporal.Now.instant();
  const zonedNow = now.toZonedDateTimeISO('UTC');
  if (timeWindow === 'today') return [`updated:>=${zonedNow.toPlainDate().toString()}`];
  if (timeWindow === 'week') return [`updated:>=${zonedNow.subtract({ days: 7 }).toPlainDate().toString()}`];
  if (timeWindow === 'month') return [`updated:>=${zonedNow.subtract({ months: 1 }).toPlainDate().toString()}`];
  return [];
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
