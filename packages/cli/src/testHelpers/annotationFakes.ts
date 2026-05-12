import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import type { AnnotationDependencies } from '#src/annotation/runAnnotation.ts';

export function createAnnotationDependencies(options: { submission: AnnotationSubmission }): AnnotationDependencies {
  const { submission } = options;
  return {
    loadHtml: () => Promise.resolve('<html><body>annotation</body></html>'),
    startReviewServer: () => ({
      port: 4312,
      url: 'http://localhost:4312',
      result: Promise.resolve(submission),
      close: () => Promise.resolve(),
    }),
    registerSigintHandler: () => () => {},
  };
}
