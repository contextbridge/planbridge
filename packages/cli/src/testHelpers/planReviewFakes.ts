import type { PlanReviewSubmission } from '@contextbridge/shared/planReviewSchema';
import type { PlanReviewDependencies } from '#src/planReview/runPlanReview.ts';

export function createPlanReviewDependencies(options: { submission: PlanReviewSubmission }): PlanReviewDependencies {
  const { submission } = options;
  return {
    loadHtml: () => Promise.resolve('<html><body>plan review</body></html>'),
    startReviewServer: () => ({
      port: 4312,
      url: 'http://localhost:4312',
      result: Promise.resolve(submission),
      close: () => Promise.resolve(),
    }),
    registerSigintHandler: () => () => {},
  };
}
