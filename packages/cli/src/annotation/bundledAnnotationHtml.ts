// Static text import — keeps `contextbridge plan` cold start at ~120 ms instead
// of ~2 s (see https://github.com/contextbridge/cb-cli/pull/71).
// Isolated in this leaf module so the import only resolves when it's loaded:
// `packages/annotation/dist/` is gitignored, so a parse-time import inside
// runAnnotation would break tests that don't build the bundle.
import html from '../../../annotation/dist/index.html' with { type: 'text' };

export const bundledAnnotationHtml = html as unknown as string;
