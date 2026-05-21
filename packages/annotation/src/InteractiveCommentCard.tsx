import { cn } from '@contextbridge/ui/lib/utils';
import { X } from 'lucide-react';
import { type ReactNode, useRef } from 'react';

export interface InteractiveCommentCardProps {
  heading?: string;
  disabled: boolean;
  current?: boolean;
  className?: string;
  testId?: string;
  removeButtonTestId?: string;
  onClick: (cardElement: HTMLElement) => void;
  onHoverChange?: (hovered: boolean) => void;
  onRequestRemove: () => void;
  children: ReactNode;
}

export function InteractiveCommentCard({
  heading,
  disabled,
  current = false,
  className,
  testId,
  removeButtonTestId,
  onClick,
  onHoverChange,
  onRequestRemove,
  children,
}: InteractiveCommentCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      aria-current={current ? 'true' : undefined}
      ref={cardRef}
      className={cn(
        'relative rounded-md border px-3 py-3 transition',
        !className && 'border-border bg-background hover:border-chart-3/30',
        disabled ? 'cursor-default' : 'cursor-pointer',
        className,
      )}
      onClick={() => {
        if (disabled || !cardRef.current) {
          return;
        }
        onClick(cardRef.current);
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !disabled && cardRef.current) {
          event.preventDefault();
          onClick(cardRef.current);
        }
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      role="button"
      data-testid={testId}
      tabIndex={disabled ? -1 : 0}
    >
      <RemoveCardButton disabled={disabled} onClick={onRequestRemove} testId={removeButtonTestId} />
      {heading ? (
        <p className="pr-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{heading}</p>
      ) : null}
      {children}
    </div>
  );
}

interface RemoveCardButtonProps {
  disabled: boolean;
  onClick: () => void;
  testId?: string;
}

function RemoveCardButton({ disabled, onClick, testId }: RemoveCardButtonProps) {
  return (
    <button
      aria-label="Remove comment"
      className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      data-testid={testId}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      type="button"
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}
