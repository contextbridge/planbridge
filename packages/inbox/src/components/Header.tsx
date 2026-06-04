import { appTestIds } from '../testIds.ts';

export const headerCopy = {
  title: 'ContextBridge Inbox',
  refresh: 'Refresh',
  close: 'Press Ctrl+C in your terminal to end the session.',
} as const;

export interface HeaderProps {
  readonly viewer: string | null;
  readonly onRefresh: () => void;
}

export function Header({ viewer, onRefresh }: HeaderProps) {
  return (
    <header data-testid={appTestIds.header} className="border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{headerCopy.title}</h1>
          {viewer && (
            <span data-testid={appTestIds.viewerLogin} className="text-sm text-muted-foreground">
              {viewer}
            </span>
          )}
        </div>
        <button
          data-testid={appTestIds.refreshButton}
          type="button"
          className="rounded px-3 py-1 text-sm hover:bg-muted"
          onClick={onRefresh}
        >
          {headerCopy.refresh}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{headerCopy.close}</p>
    </header>
  );
}
