import type { IterationChange } from './iterationChanges.ts';
import { ThreadedCommentCard } from './ThreadedCommentCard.tsx';

export const inlineChangeThreadTestIds = {
  thread: (changeId: string) => `iteration-inline-thread-${changeId}`,
};

export interface InlineChangeThreadProps {
  change: IterationChange;
}

export function InlineChangeThread({ change }: InlineChangeThreadProps) {
  if (change.kind === 'removed') {
    return null;
  }

  return (
    <div className="mt-3 ml-6" data-testid={inlineChangeThreadTestIds.thread(change.id)}>
      <ThreadedCommentCard comments={change.comments} kind={change.kind} />
    </div>
  );
}
