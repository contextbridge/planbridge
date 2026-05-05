// Isolated so the text import only resolves when this module is loaded.
// `packages/plan/dist/` is gitignored — a parse-time import in runPlanReview
// would break tests that don't build the bundle.
import html from '../../../plan/dist/index.html' with { type: 'text' };

export const bundledPlanHtml = html as unknown as string;
