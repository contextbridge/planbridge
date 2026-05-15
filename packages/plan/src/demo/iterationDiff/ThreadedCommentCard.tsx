import { cn } from '@contextbridge/ui/lib/utils';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';
import type { IterationChangeKind, IterationThreadComment } from './iterationChanges.ts';

export interface ThreadedCommentCardProps {
  comments: IterationThreadComment[];
  kind: IterationChangeKind;
  active?: boolean;
  focusReplyToken?: number;
}

interface ChangeKindPresentation {
  label: string;
  activeBorderClass: string;
  dotClass: string;
}

const CHANGE_KIND_PRESENTATION: Record<IterationChangeKind, ChangeKindPresentation> = {
  added: {
    label: 'Added',
    activeBorderClass: 'border-[var(--color-green-500)]',
    dotClass: 'bg-[var(--color-green-500)]',
  },
  modified: {
    label: 'Modified',
    activeBorderClass: 'border-[var(--color-amber-500)]',
    dotClass: 'bg-[var(--color-amber-500)]',
  },
  removed: {
    label: 'Removed',
    activeBorderClass: 'border-[var(--red)]',
    dotClass: 'bg-[var(--red)]',
  },
  reordered: {
    label: 'Modified',
    activeBorderClass: 'border-[var(--color-amber-500)]',
    dotClass: 'bg-[var(--color-amber-500)]',
  },
};

export function ThreadedCommentCard({ comments, kind, active = false, focusReplyToken }: ThreadedCommentCardProps) {
  const presentation = CHANGE_KIND_PRESENTATION[kind];
  const replyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focusReplyToken === undefined) {
      return;
    }
    replyRef.current?.focus({ preventScroll: true });
  }, [focusReplyToken]);

  const handleReplyInput = () => {
    const textarea = replyRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleReplyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.currentTarget.blur();
    }
    event.stopPropagation();
  };

  return (
    <div
      aria-current={active ? 'true' : undefined}
      className={cn('rounded-md border bg-muted', active ? presentation.activeBorderClass : 'border-border')}
    >
      <header className="border-b border-border px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
          <span
            aria-hidden
            className={cn('size-2 rounded-full', presentation.dotClass, active ? 'cb-iteration-thread-dot-active' : null)}
          />
          {presentation.label}
        </span>
      </header>

      <div className="px-3 py-3">
        <div className="relative space-y-4 before:absolute before:top-8 before:bottom-4 before:left-4 before:w-px before:bg-border">
          {comments.map((comment) => (
            <ThreadComment key={comment.id} comment={comment} />
          ))}
        </div>

        <div
          className="mt-3 overflow-hidden rounded-sm border border-border bg-background focus-within:ring-2 focus-within:ring-ring"
          onClick={(event) => event.stopPropagation()}
        >
          <textarea
            className="max-h-32 min-h-9 w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 text-sm leading-5 text-foreground [field-sizing:content] placeholder:text-muted-foreground focus-visible:outline-none"
            onInput={handleReplyInput}
            onKeyDown={handleReplyKeyDown}
            placeholder="Write a reply"
            ref={replyRef}
            rows={1}
          />
          <div className="flex justify-end border-t border-border bg-muted/30 px-2 py-1.5">
            <button
              className="rounded-sm bg-primary px-2.5 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              type="button"
            >
              Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadComment({ comment }: { comment: IterationThreadComment }) {
  const isAssistant = comment.authorKind === 'assistant';
  const authorLabel = isAssistant ? 'Agent' : 'You';

  return (
    <article className="relative flex gap-2">
      <span
        className={cn(
          'relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold',
          isAssistant ? 'text-chart-3' : 'text-foreground/70',
        )}
      >
        {isAssistant ? 'A' : 'Y'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-5 font-semibold text-foreground/90">{authorLabel}</div>
        <p className="mt-0.5 text-sm leading-6 text-foreground/85">{comment.body}</p>
      </div>
    </article>
  );
}
