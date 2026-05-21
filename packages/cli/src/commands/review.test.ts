import type { ServerContext } from '@contextbridge/server/context';
import type { RunningReviewServer, StartReviewServerOptions } from '@contextbridge/server/review';
import { createDeferred } from '@contextbridge/shared/testHelpers';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { createStubContext, readErrorLogs, readLogs } from '#src/testHelpers/index.ts';
import { type ReviewDependencies, reviewScaffoldStdout, runReview } from './review.ts';

describe('review handler', () => {
  it('opens the review URL, awaits the server result, and writes the scaffold stdout', async () => {
    const openedUrls: string[] = [];
    const { context, io } = createStubContext({
      openUrl: (url) => {
        openedUrls.push(url);
        return Promise.resolve();
      },
    });
    const deps = createFakeReviewDeps({ result: Promise.resolve() });

    await runReview(context, {}, deps);

    expect(io.stdout.text()).toBe(reviewScaffoldStdout);
    expect(openedUrls).toEqual(['http://localhost:4313']);
    expect(deps.closed).toBe(true);
  });

  it('forwards an explicit --port to the server', async () => {
    const { context } = createStubContext();
    const deps = createFakeReviewDeps({ result: Promise.resolve() });

    await runReview(context, { port: 4567 }, deps);

    expect(deps.port).toBe(4567);
  });

  it('closes the server and exits with CommanderError(130) on SIGINT', async () => {
    const { context, io, logs } = createStubContext();
    const deps = createFakeReviewDeps({ result: createDeferred<void>().promise });

    const reviewPromise = runReview(context, {}, deps);
    await deps.sigintHandlerRegistered;
    deps.triggerSigint();

    expect(reviewPromise).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(deps.closed).toBe(true);
    expect(readLogs(logs).some((r) => r.msg === 'review interrupted')).toBe(true);
    expect(readErrorLogs(logs)).toEqual([]);
  });

  it('closes the server and surfaces a runtime error when openUrl rejects', () => {
    const { context, io } = createStubContext({ openUrl: () => Promise.reject(new Error('open failed')) });
    const deps = createFakeReviewDeps({ result: createDeferred<void>().promise });

    expect(runReview(context, {}, deps)).rejects.toBeInstanceOf(CommanderError);
    expect(io.stdout.text()).toBe('');
    expect(deps.closed).toBe(true);
  });
});

interface FakeReviewDeps extends ReviewDependencies {
  readonly closed: boolean;
  readonly port: number | undefined;
  readonly sigintHandlerRegistered: Promise<void>;
  triggerSigint(): void;
}

function createFakeReviewDeps({ result }: { result: Promise<void> }): FakeReviewDeps {
  const sigintRegistration = createDeferred<void>();
  let closeCount = 0;
  let observedPort: number | undefined;
  let sigintHandler: (() => void) | null = null;

  return {
    sigintHandlerRegistered: sigintRegistration.promise,
    get closed() {
      return closeCount > 0;
    },
    get port() {
      return observedPort;
    },
    triggerSigint() {
      if (!sigintHandler) throw new Error('SIGINT handler was not registered');
      sigintHandler();
    },
    loadHtml: () => Promise.resolve('<html><body>review scaffold</body></html>'),
    startReviewServer: (_ctx: ServerContext, { port }: StartReviewServerOptions): RunningReviewServer => {
      observedPort = port;
      return {
        port: 4313,
        url: 'http://localhost:4313',
        result,
        close: () => {
          closeCount += 1;
          return Promise.resolve();
        },
      };
    },
    registerSigintHandler: (handler) => {
      sigintHandler = handler;
      sigintRegistration.resolve();
      return () => {
        sigintHandler = null;
      };
    },
  };
}
