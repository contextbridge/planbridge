import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { annotationSubmission } from '@contextbridge/shared/testFactories';
import type { AnnotationDependencies } from '#src/annotation/runAnnotation.ts';
import { createDeferred } from './createDeferred.ts';

export interface TrackedAnnotationDependencies extends AnnotationDependencies {
  /** Payloads passed to startReviewServer in invocation order. */
  payloads: AnnotationPayload[];
  /** Submission the fake server resolves with (unless `result` overrides it). */
  submission: AnnotationSubmission;
  /** Number of times the server's close() has been invoked. */
  closeCount: number;
  /** Convenience: true iff closeCount > 0. */
  closed: boolean;
  /** Resolves when registerSigintHandler has been called at least once. */
  sigintHandlerRegistered: Promise<void>;
  /** Set when the un-register function returned by registerSigintHandler is invoked. */
  sigintHandlerRemoved: boolean;
  /** Fires the most-recently-registered SIGINT handler. Throws if none registered. */
  triggerSigint(): void;
}

/**
 * Tracked `AnnotationDependencies` stub for handler tests. Captures payloads,
 * close counts, and SIGINT lifecycle so tests can assert on the orchestration
 * boundary without spinning up a real browser session.
 */
export function createAnnotationDependencies(
  options: {
    submission?: AnnotationSubmission;
    result?: Promise<AnnotationSubmission>;
  } = {},
): TrackedAnnotationDependencies {
  const payloads: AnnotationPayload[] = [];
  const submission = options.submission ?? annotationSubmission.build();
  const sigintRegistration = createDeferred<void>();
  let closeCount = 0;
  let sigintHandler: (() => void) | null = null;
  let sigintHandlerRemoved = false;

  return {
    payloads,
    submission,
    sigintHandlerRegistered: sigintRegistration.promise,
    get closeCount() {
      return closeCount;
    },
    get closed() {
      return closeCount > 0;
    },
    get sigintHandlerRemoved() {
      return sigintHandlerRemoved;
    },
    triggerSigint() {
      if (!sigintHandler) {
        throw new Error('SIGINT handler was not registered');
      }

      sigintHandler();
    },
    loadHtml: () => Promise.resolve('<html><body>annotation</body></html>'),
    startReviewServer: (_ctx, { payload }) => {
      payloads.push(payload);
      return {
        port: 4312,
        url: 'http://localhost:4312',
        result: options.result ?? Promise.resolve(submission),
        close: () => {
          closeCount += 1;
          return Promise.resolve();
        },
      };
    },
    registerSigintHandler: (handler) => {
      sigintHandler = handler;
      sigintHandlerRemoved = false;
      sigintRegistration.resolve();
      return () => {
        sigintHandlerRemoved = true;
        sigintHandler = null;
      };
    },
  };
}
