import { useEffect, useRef } from 'react';
import { IterationChangeCard } from './IterationChangeCard.tsx';
import type { IterationChange } from './iterationChanges.ts';

export const iterationAnchoredCommentsSidebarTestIds = {
  container: 'iteration-anchored-comments-sidebar',
  threadList: 'iteration-anchored-comments-list',
};

export interface IterationAnchoredCommentsSidebarProps {
  activeChangeId: string | null;
  changes: IterationChange[];
  focusReplyRequest: ReplyFocusRequest | null;
  onChangeSelect: (changeId: string) => void;
}

export interface ReplyFocusRequest {
  changeId: string;
  token: number;
}

export function IterationAnchoredCommentsSidebar({
  activeChangeId,
  changes,
  focusReplyRequest,
  onChangeSelect,
}: IterationAnchoredCommentsSidebarProps) {
  const activeThreadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeThreadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeChangeId]);

  return (
    <aside
      className="sticky top-[6.75rem] flex max-h-[calc(100vh-6.75rem)] min-w-0 flex-col self-start"
      data-testid={iterationAnchoredCommentsSidebarTestIds.container}
    >
      <section className="flex min-h-0 flex-1 flex-col border-l border-border bg-background p-4">
        <div
          className="flex-1 space-y-3 overflow-y-auto pr-1"
          data-testid={iterationAnchoredCommentsSidebarTestIds.threadList}
        >
          {changes.map((change) => {
            const active = change.id === activeChangeId;
            return (
              <div key={change.id} ref={active ? activeThreadRef : undefined}>
                <IterationChangeCard
                  active={active}
                  change={change}
                  focusReplyToken={getFocusReplyToken(change.id, focusReplyRequest)}
                  onSelect={onChangeSelect}
                />
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

function getFocusReplyToken(changeId: string, request: ReplyFocusRequest | null): number | undefined {
  if (request?.changeId !== changeId) {
    return undefined;
  }
  return request.token;
}
