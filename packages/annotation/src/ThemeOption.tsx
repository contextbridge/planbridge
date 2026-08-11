import { cn } from '@contextbridge/ui/lib/utils';
import { Check } from 'lucide-react';
import type { ThemePreference } from './themes.ts';

export interface ThemeOptionProps {
  readonly colors: readonly string[];
  readonly label: string;
  readonly onSelect: (preference: ThemePreference) => void;
  readonly preference: ThemePreference;
  readonly selected: boolean;
  readonly testId: string;
}

export function ThemeOption({ colors, label, onSelect, preference, selected, testId }: ThemeOptionProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'group relative overflow-hidden rounded-md border bg-background text-left outline-none transition-colors hover:border-foreground/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
        selected && 'border-primary ring-1 ring-primary/50',
      )}
      data-testid={testId}
      onClick={() => onSelect(preference)}
      type="button"
    >
      <span className="flex h-9 items-center gap-1 px-2.5" aria-hidden="true">
        {colors.map((color, index) => (
          <span
            className="size-4 rounded-full border border-foreground/30"
            key={`${color}-${index}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
      <span className="flex items-center gap-2 border-t border-border/70 px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{label}</span>
        <Check className={cn('size-3.5 text-primary transition-opacity', selected ? 'opacity-100' : 'opacity-0')} />
      </span>
    </button>
  );
}
