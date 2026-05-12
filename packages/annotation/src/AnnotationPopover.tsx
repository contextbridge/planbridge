import { Button } from '@contextbridge/ui/components/ui/button';
import { Textarea } from '@contextbridge/ui/components/ui/textarea';
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { useEffect, useId } from 'react';
import { useSubmitOnCmdEnter } from './useSubmitOnCmdEnter.ts';

export const annotationPopoverTestIds = {
  container: 'plan-review-annotation-popover',
  textarea: 'plan-review-annotation-popover-textarea',
  cancelButton: 'plan-review-annotation-popover-cancel',
  saveButton: 'plan-review-annotation-popover-save',
};

export interface AnnotationPopoverProps {
  open: boolean;
  body: string;
  getRect: (() => DOMRect | null) | null;
  title?: string;
  onBodyChange: (nextBody: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function AnnotationPopover({
  open,
  body,
  getRect,
  title = 'Comment',
  onBodyChange,
  onCancel,
  onSave,
}: AnnotationPopoverProps) {
  const textareaId = useId();
  const handleKeyDown = useSubmitOnCmdEnter(() => {
    if (body.trim().length > 0) {
      onSave();
    }
  });
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (nextOpen: boolean) => {
      if (!nextOpen) {
        onCancel();
      }
    },
    placement: 'top-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [offset(14), flip({ padding: 16 }), shift({ padding: 16 })],
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    if (!open || !getRect) {
      return;
    }

    refs.setPositionReference({
      getBoundingClientRect: () => getRect() ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0),
    });
  }, [open, getRect, refs]);

  if (!open || !getRect) {
    return null;
  }

  return (
    <FloatingPortal>
      <div
        ref={(node) => refs.setFloating(node)}
        style={floatingStyles}
        className="z-50 w-[min(26rem,calc(100vw-2rem))]"
        data-testid={annotationPopoverTestIds.container}
        {...getFloatingProps()}
      >
        <div className="rounded-md border border-border bg-popover p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
            <button
              className="text-sm text-muted-foreground transition hover:text-foreground"
              data-testid={annotationPopoverTestIds.cancelButton}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          </div>
          <Textarea
            autoFocus
            aria-label={title}
            className="mt-3 min-h-32 resize-y rounded-md border bg-background px-3 py-3 text-sm leading-6 transition focus-visible:border-chart-3/40 focus-visible:ring-chart-3/10"
            data-testid={annotationPopoverTestIds.textarea}
            id={textareaId}
            onChange={(event) => {
              onBodyChange(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment."
            value={body}
          />
          <div className="mt-4 flex justify-end">
            <Button
              data-testid={annotationPopoverTestIds.saveButton}
              disabled={body.trim().length === 0}
              onClick={onSave}
              type="button"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </FloatingPortal>
  );
}
