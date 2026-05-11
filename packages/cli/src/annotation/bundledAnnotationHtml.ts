// Isolated so the text import only resolves when this module is loaded.
// `packages/annotation/dist/` is gitignored — a parse-time import in runAnnotation
// would break tests that don't build the bundle.
import html from '../../../annotation/dist/index.html' with { type: 'text' };

export const bundledAnnotationHtml = html as unknown as string;
