import { type KeyboardEvent } from 'react';
import type { IterationChange } from './iterationChanges.ts';
import { ThreadedCommentCard } from './ThreadedCommentCard.tsx';

export const iterationChangeCardTestIds = {
  card: (changeId: string) => `iteration-change-card-${changeId}`,
};

export interface IterationChangeCardProps {
  change: IterationChange;
  active?: boolean;
  focusReplyToken?: number;
  onSelect?: (changeId: string) => void;
}

export function IterationChangeCard({ change, active = false, focusReplyToken, onSelect }: IterationChangeCardProps) {
  const selectable = onSelect !== undefined;

  const handleClick = () => {
    onSelect?.(change.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!selectable || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }
    event.preventDefault();
    onSelect(change.id);
  };

  return (
    <article
      className={
        selectable
          ? 'cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          : undefined
      }
      data-testid={iterationChangeCardTestIds.card(change.id)}
      onClick={selectable ? handleClick : undefined}
      onKeyDown={selectable ? handleKeyDown : undefined}
      tabIndex={selectable ? 0 : undefined}
    >
      <ThreadedCommentCard
        active={active}
        comments={change.comments}
        focusReplyToken={focusReplyToken}
        kind={change.kind}
      />
    </article>
  );
}
