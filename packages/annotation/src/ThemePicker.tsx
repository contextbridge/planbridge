import { Button } from '@contextbridge/ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@contextbridge/ui/components/ui/popover';
import { cn } from '@contextbridge/ui/lib/utils';
import { Check, Palette } from 'lucide-react';
import type { ThemePreference } from './themes.ts';
import { systemThemeIds, themeById, themes } from './themes.ts';

export const themePickerTestIds = {
  trigger: 'theme-picker-trigger',
  content: 'theme-picker-content',
  option: (preference: ThemePreference) => `theme-picker-option-${preference}`,
};

export interface ThemePickerProps {
  readonly preference: ThemePreference;
  readonly onSelect: (preference: ThemePreference) => void;
}

export function ThemePicker({ preference, onSelect }: ThemePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Theme Settings"
          data-testid={themePickerTestIds.trigger}
          size="icon-xs"
          title="Theme Settings"
          variant="ghost"
        >
          <Palette className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(38rem,var(--radix-popover-content-available-height))] w-[min(38rem,calc(100vw-2rem))] overflow-y-auto p-0"
        data-testid={themePickerTestIds.content}
        sideOffset={8}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Theme</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Choose a palette for the review and its code blocks.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
          <ThemeOption
            colors={systemPreviewColors}
            label="System"
            onSelect={onSelect}
            preference="system"
            selected={preference === 'system'}
          />
          {themes.map((theme) => (
            <ThemeOption
              key={theme.id}
              colors={theme.preview}
              label={theme.label}
              onSelect={onSelect}
              preference={theme.id}
              selected={preference === theme.id}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ThemeOptionProps {
  readonly colors: readonly string[];
  readonly label: string;
  readonly onSelect: (preference: ThemePreference) => void;
  readonly preference: ThemePreference;
  readonly selected: boolean;
}

function ThemeOption({ colors, label, onSelect, preference, selected }: ThemeOptionProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'group relative overflow-hidden rounded-md border bg-background text-left outline-none transition-colors hover:border-foreground/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
        selected && 'border-primary ring-1 ring-primary/50',
      )}
      data-testid={themePickerTestIds.option(preference)}
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

const systemLight = themeById.get(systemThemeIds.light)!;
const systemDark = themeById.get(systemThemeIds.dark)!;
const systemPreviewColors = [...systemLight.preview.slice(0, 3), ...systemDark.preview.slice(0, 3)];
