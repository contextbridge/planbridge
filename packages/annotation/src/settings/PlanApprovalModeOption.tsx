import type { ClaudePlanApprovalMode } from '@contextbridge/shared/claudeSettingsSchema';
import { cn } from '@contextbridge/ui/lib/utils';
import { Check } from 'lucide-react';

export interface PlanApprovalModeOptionProps {
  readonly description: string;
  readonly label: string;
  readonly mode: ClaudePlanApprovalMode;
  readonly onSelect: (mode: ClaudePlanApprovalMode) => void;
  readonly selected: boolean;
  readonly testId: string;
}

export function PlanApprovalModeOption({
  description,
  label,
  mode,
  onSelect,
  selected,
  testId,
}: PlanApprovalModeOptionProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-2 rounded-md border bg-background px-3 py-2 text-left outline-none transition-colors hover:border-foreground/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
        selected && 'border-primary ring-1 ring-primary/50',
      )}
      data-testid={testId}
      onClick={() => onSelect(mode)}
      type="button"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <Check
        className={cn(
          'mt-0.5 size-3.5 shrink-0 text-primary transition-opacity',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      />
    </button>
  );
}
