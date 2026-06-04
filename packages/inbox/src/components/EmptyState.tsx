import { appTestIds } from '../testIds.ts';

export const emptyStateCopy = {
  title: 'All Caught Up',
  description: 'No items need your attention right now.',
} as const;

export function EmptyState() {
  return (
    <div data-testid={appTestIds.emptyState} className="mx-auto max-w-xl px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{emptyStateCopy.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{emptyStateCopy.description}</p>
    </div>
  );
}
