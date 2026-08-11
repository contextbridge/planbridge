import { cn } from '@contextbridge/ui/lib/utils';

export interface SettingsNavItemProps {
  readonly active: boolean;
  readonly label: string;
  readonly onSelect: () => void;
  readonly testId: string;
}

export function SettingsNavItem({ active, label, onSelect, testId }: SettingsNavItemProps) {
  return (
    <button
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
        active && 'bg-muted font-medium text-foreground',
      )}
      data-testid={testId}
      onClick={onSelect}
      type="button"
    >
      {label}
    </button>
  );
}
