import type { ServerContext } from '@contextbridge/server/context';
import { type RunningInboxServer, type StartInboxServerOptions, startInboxServer } from '@contextbridge/server/inbox';
import { getErrorMessage } from '@contextbridge/shared/errors';
import type { InboxFilters } from '@contextbridge/shared/inboxSchema';
import { type Command, CommanderError, InvalidArgumentError } from 'commander';
import {
  AnnotationEnvironmentError,
  AnnotationInterruptedError,
  isLikelyLocalServerNetworkSandboxError,
} from '#src/annotation/runAnnotation.ts';
import type { CliContext } from '#src/context.ts';
import { parsePort } from '#src/environment.ts';
import { GhCliInboxClient } from '#src/inbox/ghCliInboxClient.ts';
import { abort } from './abort.ts';

export interface InboxArgs {
  readonly port?: number;
  readonly repositories?: readonly string[];
  readonly allRepos?: boolean;
  readonly includeDrafts?: boolean;
  readonly includeDependabot?: boolean;
}

export interface InboxDependencies {
  loadHtml(): Promise<string>;
  createInboxService(ctx: CliContext, args: InboxArgs): GhCliInboxClient;
  startInboxServer(ctx: ServerContext, opts: StartInboxServerOptions): RunningInboxServer;
  registerSigintHandler(handler: () => void): () => void;
}

export async function runInbox(
  ctx: CliContext,
  args: InboxArgs,
  deps: InboxDependencies = defaultInboxDependencies,
): Promise<void> {
  const { logger, openUrl, env } = ctx;
  const { port = env.CONTEXTBRIDGE_PORT } = args;

  let server: RunningInboxServer | null = null;
  let removeSigintHandler = () => {};
  let closePromise: Promise<void> | null = null;
  let sigintHandled = false;
  let rejectSigint!: (error: Error) => void;
  const sigintPromise = new Promise<never>((_, reject) => {
    rejectSigint = reject;
  });
  void sigintPromise.catch(() => {});

  try {
    const inboxService = deps.createInboxService(ctx, args);
    const preflight = await inboxService.preflight();
    if (preflight.isErr())
      abort(
        ctx,
        'inbox',
        preflight.error.code === 'gh_auth' || preflight.error.code === 'gh_missing' ? 'environment' : 'runtime',
        preflight.error.message,
      );

    const htmlPromise = deps.loadHtml();
    htmlPromise.catch((err: unknown) => logger.error({ err }, 'failed to load inbox UI bundle'));

    try {
      server = deps.startInboxServer(ctx, { html: htmlPromise, inboxService, port });
    } catch (err) {
      if (isLikelyLocalServerNetworkSandboxError(err, port ?? 0)) {
        throw new AnnotationEnvironmentError(err);
      }
      throw err;
    }

    removeSigintHandler = deps.registerSigintHandler(() => {
      if (sigintHandled) return;
      sigintHandled = true;
      void closeServer();
      rejectSigint(new AnnotationInterruptedError('inbox interrupted by SIGINT'));
    });

    logger.info({ url: server.url }, 'opening inbox browser session');
    await Promise.race([openUrl(server.url), sigintPromise]);
    await Promise.race([server.result, sigintPromise]);
  } catch (err) {
    if (err instanceof CommanderError) throw err;
    if (err instanceof AnnotationInterruptedError) {
      logger.info('inbox interrupted');
      throw new CommanderError(130, 'contextbridge.inbox.sigint', 'inbox interrupted');
    }
    if (err instanceof AnnotationEnvironmentError) {
      abort(ctx, 'inbox', 'environment', err.message);
    }
    abort(ctx, 'inbox', 'runtime', getErrorMessage(err));
  } finally {
    removeSigintHandler();
    await closeServer();
  }

  function closeServer(): Promise<void> {
    if (!server) return Promise.resolve();
    closePromise ??= server.close();
    return closePromise;
  }
}

export function registerInbox(ctx: CliContext, program: Command): void {
  program
    .command('inbox')
    .summary('Open a local GitHub attention inbox dashboard.')
    .description('Open a local GitHub attention inbox dashboard powered by the installed GitHub CLI (`gh`).')
    .option(
      '--repo <owner/name>',
      'limit inbox queries to a GitHub repository; repeat or comma-separate for many',
      collectRepositories,
      [] as string[],
    )
    .option('--all-repos', 'query all repositories visible to gh, even inside a GitHub worktree')
    .option('--include-drafts', 'include draft pull requests')
    .option('--include-dependabot', 'include Dependabot-authored items')
    .option('--port <number>', 'serve the inbox browser UI on a specific port', parsePortOption)
    .action(async (opts: InboxCommandOptions) => {
      await runInbox(ctx, {
        port: opts.port,
        repositories: opts.repo,
        allRepos: opts.allRepos,
        includeDrafts: opts.includeDrafts,
        includeDependabot: opts.includeDependabot,
      });
    });
}

interface InboxCommandOptions {
  readonly repo: string[];
  readonly allRepos?: boolean;
  readonly includeDrafts?: boolean;
  readonly includeDependabot?: boolean;
  readonly port?: number;
}

const defaultInboxDependencies: InboxDependencies = {
  loadHtml: () => import('#src/inbox/bundledInboxHtml.ts').then((m) => m.bundledInboxHtml),
  createInboxService: (ctx, args) =>
    new GhCliInboxClient(ctx, {
      repositories: args.repositories,
      allRepos: args.allRepos,
      filters: buildInitialFilters(args),
    }),
  startInboxServer: (ctx, opts) => startInboxServer(ctx, opts),
  registerSigintHandler: (handler) => {
    process.on('SIGINT', handler);
    return () => {
      process.off('SIGINT', handler);
    };
  },
};

function collectRepositories(value: string, previous: string[]): string[] {
  return [
    ...previous,
    ...value
      .split(',')
      .map((repo) => repo.trim())
      .filter((repo) => repo.length > 0),
  ];
}

function buildInitialFilters(args: InboxArgs): InboxFilters {
  return {
    includeDrafts: args.includeDrafts,
    includeDependabot: args.includeDependabot,
  };
}

function parsePortOption(value: string): number {
  try {
    return parsePort(value);
  } catch {
    throw new InvalidArgumentError('port must be an integer between 1 and 65535');
  }
}
