export const commentNavigationBarTestIds = {
  container: 'plan-review-comment-navigation-bar',
};

export function CommentNavigationBar() {
  return (
    <nav
      aria-label="Comment shortcuts"
      className="border-b border-border pb-3"
      data-testid={commentNavigationBarTestIds.container}
    >
      <div className="grid w-full grid-cols-[1fr_auto] items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium">Shortcuts</span>
        <div className="flex items-center gap-3 justify-self-end">
          <ShortcutHint label="Open" shortcut="C" />
          <ShortcutHint label="Previous" shortcut="K" />
          <ShortcutHint label="Next" shortcut="J" />
        </div>
      </div>
    </nav>
  );
}

interface ShortcutHintProps {
  label: string;
  shortcut: string;
}

function ShortcutHint({ label, shortcut }: ShortcutHintProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}{' '}
      <kbd className="inline-grid h-4 min-w-4 place-items-center rounded border border-border px-1 font-mono text-[0.65rem] leading-none text-muted-foreground">
        {shortcut}
      </kbd>
    </span>
  );
}
