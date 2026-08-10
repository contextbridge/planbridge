import { startServer } from '@contextbridge/server/annotation';
import type { RunningServer } from '@contextbridge/server/annotation';
import type { ServerContext } from '@contextbridge/server/context';
import type {
  AnnotationEntrypoint,
  AnnotationPayload,
  AnnotationSubmission,
  ContentKind,
} from '@contextbridge/shared/annotationSchema';
import { getErrorMessage, hasErrorCode } from '@contextbridge/shared/errors';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import type { SettingsStore } from '@contextbridge/shared/settingsStore';
import { nowInstant } from '@contextbridge/shared/time';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { CliContext } from '#src/context.ts';
import { extractAssets } from './extractAssets.ts';
import { extractDocumentTitle } from './extractDocumentTitle.ts';

export class AnnotationInterruptedError extends Error {
  constructor(message = 'annotation interrupted by SIGINT') {
    super(message);
    this.name = 'AnnotationInterruptedError';
  }
}

export class AnnotationEnvironmentError extends Error {
  constructor(cause: unknown) {
    super(
      'ContextBridge could not start its local browser server. Your coding harness may be running contextbridge in a network sandbox that blocks localhost. Allow local network access for contextbridge or run it outside the sandbox, then try again.',
      { cause },
    );
    this.name = 'AnnotationEnvironmentError';
  }
}

export interface RunAnnotationArgs {
  content: string;
  contentKind: ContentKind;
  entrypoint: AnnotationEntrypoint;
  port?: number;
  sourcePath?: string;
}

export interface AnnotationDependencies {
  loadHtml(): Promise<string>;
  startReviewServer(
    ctx: ServerContext,
    args: {
      html: Promise<string>;
      payload: AnnotationPayload;
      config: FrontendConfig;
      port?: number;
      checkForUpdate?: () => Promise<UpdateNotice | null>;
      updateSettings: SettingsStore['patch'];
    },
  ): RunningServer;
  registerSigintHandler(handler: () => void): () => void;
}

export async function runAnnotation(
  ctx: CliContext,
  args: RunAnnotationArgs,
  deps: AnnotationDependencies = defaultAnnotationDependencies,
): Promise<AnnotationSubmission> {
  const { analytics, logger, openUrl, frontendConfig, settingsStore, updater, env } = ctx;
  const { port = env.CONTEXTBRIDGE_PORT } = args;
  const startedAt = nowInstant();

  const payload: AnnotationPayload = {
    content: args.content,
    title: extractDocumentTitle(args.content),
    contentKind: args.contentKind,
    metadata: {
      entrypoint: args.entrypoint,
      ...(args.sourcePath ? { sourcePath: args.sourcePath } : {}),
    },
  };
  analytics.capture('plan_review_started', { source: args.entrypoint });

  const config: FrontendConfig = {
    ...frontendConfig,
    settings: await settingsStore.read(),
  };

  const assets = await extractAssets(ctx, {
    content: args.content,
    sourcePath: args.sourcePath,
  });
  if (assets.length > 0) {
    payload.assets = assets;
  }

  let server: RunningServer | null = null;
  let removeSigintHandler = () => {};
  let closePromise: Promise<void> | null = null;
  let sigintHandled = false;
  let rejectSigint!: (error: Error) => void;
  const sigintPromise = new Promise<never>((_, reject) => {
    rejectSigint = reject;
  });
  void sigintPromise.catch(() => {});

  try {
    // Kick off the annotation-UI bundle decode without blocking. The server awaits
    // this lazily on the first GET / so the decode runs in parallel with
    // `Bun.serve` bind + browser launch.
    const htmlPromise = deps.loadHtml();
    htmlPromise.catch((err: unknown) => logger.error({ err }, 'failed to load annotation UI bundle'));

    try {
      server = deps.startReviewServer(ctx, {
        html: htmlPromise,
        payload,
        config,
        port,
        checkForUpdate: () => updater.checkForUpdate().catch(() => null),
        updateSettings: (patch) => settingsStore.patch(patch),
      });
    } catch (err) {
      if (isLikelyLocalServerNetworkSandboxError(err, port ?? 0)) {
        throw new AnnotationEnvironmentError(err);
      }
      throw err;
    }
    removeSigintHandler = deps.registerSigintHandler(() => {
      if (sigintHandled) {
        return;
      }

      sigintHandled = true;
      void closeServer();
      rejectSigint(new AnnotationInterruptedError());
    });

    logger.info({ url: server.url }, 'opening annotation browser session');
    await Promise.race([openUrl(server.url), sigintPromise]);

    const submittedReview = await Promise.race([server.result, sigintPromise]);
    analytics.capture('plan_review_submitted', {
      status: submittedReview.status,
      threads_count: submittedReview.threads.length,
      duration_ms: nowInstant().epochMilliseconds - startedAt.epochMilliseconds,
    });
    return submittedReview;
  } finally {
    removeSigintHandler();
    await closeServer();
  }

  function closeServer(): Promise<void> {
    if (!server) {
      return Promise.resolve();
    }

    closePromise ??= server.close();
    return closePromise;
  }
}

export function isLikelyLocalServerNetworkSandboxError(err: unknown, port: number): boolean {
  if (hasErrorCode(err, 'EACCES') || hasErrorCode(err, 'EPERM')) {
    return true;
  }

  return port === 0 && hasErrorCode(err, 'EADDRINUSE') && getErrorMessage(err).includes('port 0');
}

const defaultAnnotationDependencies: AnnotationDependencies = {
  loadHtml: () => import('./bundledAnnotationHtml.ts').then((m) => m.bundledAnnotationHtml),
  startReviewServer: (ctx, { html, payload, config, port, checkForUpdate, updateSettings }) =>
    startServer(ctx, { html, payload, config, port, checkForUpdate, updateSettings }),
  registerSigintHandler: (handler) => {
    process.on('SIGINT', handler);
    return () => {
      process.off('SIGINT', handler);
    };
  },
};
