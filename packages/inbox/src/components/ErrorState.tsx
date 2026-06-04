import { appTestIds } from '../testIds.ts';

export const errorStateCopy = {
  title: 'Failed to Load Inbox',
  retry: 'Retry',
  ghMissing:
    'GitHub CLI (`gh`) is not installed or not authenticated. Install it and run `gh auth login` before using `contextbridge inbox`.',
} as const;

export interface ErrorStateProps {
  readonly error: Error;
  readonly onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const isGhError = 'code' in error && (error.code === 'gh_missing' || error.code === 'gh_auth');

  return (
    <div data-testid={appTestIds.errorState} className="mx-auto max-w-xl px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{errorStateCopy.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{isGhError ? errorStateCopy.ghMissing : error.message}</p>
      <button
        type="button"
        className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        onClick={onRetry}
      >
        {errorStateCopy.retry}
      </button>
    </div>
  );
}
