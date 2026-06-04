// Static text import — keeps `contextbridge inbox` cold start fast.
// Isolated in this leaf module so the import only resolves when it's loaded:
// `packages/inbox/dist/` is gitignored, so a parse-time import inside
// runInbox would break tests that don't build the bundle.
import html from '../../../inbox/dist/index.html' with { type: 'text' };

export const bundledInboxHtml = html as unknown as string;
