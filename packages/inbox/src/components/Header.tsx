import { appTestIds } from '../testIds.ts';

export const headerCopy = {
  refresh: 'Refresh',
  close: 'Press Ctrl+C in your terminal to end the session.',
} as const;

export interface HeaderProps {
  readonly title: string;
  readonly viewer: string | null;
  readonly onRefresh: () => void;
}

export function Header({ title, viewer, onRefresh }: HeaderProps) {
  return (
    <header data-testid={appTestIds.header} className="border-b border-border">
      <div className="max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="font-brand text-lg font-semibold tracking-tight">{title}</h1>
            {viewer && (
              <span data-testid={appTestIds.viewerLogin} className="text-sm text-muted-foreground">
                {viewer}
              </span>
            )}
          </div>
          <button
            data-testid={appTestIds.refreshButton}
            type="button"
            className="rounded-md border border-border px-3 py-1 text-sm transition-colors hover:bg-muted"
            onClick={onRefresh}
          >
            {headerCopy.refresh}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{headerCopy.close}</p>
      </div>
    </header>
  );
}
