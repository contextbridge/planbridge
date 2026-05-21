// Static text import — keeps `contextbridge review` cold start fast.
// Isolated in this leaf module so the import only resolves when it's loaded:
// `packages/review/dist/` is gitignored, so a parse-time import inside
// runReview would break tests that don't build the bundle.
import html from '../../../review/dist/index.html' with { type: 'text' };

export const bundledReviewHtml = html as unknown as string;
