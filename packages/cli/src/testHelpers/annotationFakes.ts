import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import type { AnnotationDependencies } from '#src/annotation/runAnnotation.ts';

export interface AnnotationDependencyFake {
  deps: AnnotationDependencies;
  awaitInFlightUpdateCalls: Array<number | undefined>;
  readonly closeCalls: number;
}

export function createAnnotationDependencies(options: { submission: AnnotationSubmission }): AnnotationDependencies {
  return createAnnotationDependencyFake(options).deps;
}

export function createAnnotationDependencyFake(options: {
  submission: AnnotationSubmission;
}): AnnotationDependencyFake {
  const { submission } = options;
  const awaitInFlightUpdateCalls: Array<number | undefined> = [];
  let closeCalls = 0;
  const deps: AnnotationDependencies = {
    loadHtml: () => Promise.resolve('<html><body>annotation</body></html>'),
    startReviewServer: () => ({
      port: 4312,
      url: 'http://localhost:4312',
      result: Promise.resolve(submission),
      awaitInFlightUpdate: (timeoutMs) => {
        awaitInFlightUpdateCalls.push(timeoutMs);
        return Promise.resolve();
      },
      close: () => {
        closeCalls += 1;
        return Promise.resolve();
      },
    }),
    registerSigintHandler: () => () => {},
  };
  return {
    deps,
    awaitInFlightUpdateCalls,
    get closeCalls() {
      return closeCalls;
    },
  };
}
