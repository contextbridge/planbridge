import { appTestIds } from '../testIds.ts';

export function LoadingState() {
  return (
    <div data-testid={appTestIds.container} className="flex min-h-screen items-center justify-center">
      <div data-testid={appTestIds.container} className="text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-3 text-sm text-muted-foreground">Loading inbox…</p>
      </div>
    </div>
  );
}
