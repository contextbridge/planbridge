import { type RefObject, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { InlineChangeThread } from './InlineChangeThread.tsx';
import type { IterationChange } from './iterationChanges.ts';

export interface InlineChangeThreadsProps {
  contentRef: RefObject<HTMLDivElement | null>;
  changes: IterationChange[];
  activeChangeId: string | null;
  onHoverChange: (changeId: string, hovered: boolean) => void;
}

export function InlineChangeThreads({ contentRef, changes, activeChangeId, onHoverChange }: InlineChangeThreadsProps) {
  const [hosts, setHosts] = useState<Map<string, HTMLElement>>(new Map());

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    const next = new Map<string, HTMLElement>();
    const inserted: HTMLElement[] = [];

    for (const change of changes) {
      if (change.kind === 'removed' || change.sourceLine === undefined) {
        continue;
      }
      const block = findBlockElement(content, change);
      if (!block) {
        continue;
      }
      const host = document.createElement('div');
      host.dataset.inlineThreadHost = change.id;
      insertHost(host, block);
      inserted.push(host);
      next.set(change.id, host);
    }

    setHosts(next);

    return () => {
      for (const host of inserted) {
        host.remove();
      }
    };
  }, [changes, contentRef]);

  return (
    <>
      {Array.from(hosts.entries()).map(([id, host]) => {
        const change = changes.find((candidate) => candidate.id === id);
        if (!change) {
          return null;
        }
        return createPortal(
          <InlineChangeThread
            change={change}
            isActive={activeChangeId === id}
            onHoverChange={(hovered) => onHoverChange(id, hovered)}
          />,
          host,
          id,
        );
      })}
    </>
  );
}

function findBlockElement(content: HTMLElement, change: IterationChange): HTMLElement | null {
  if (change.sourceLine === undefined) {
    return null;
  }
  const candidates = content.querySelectorAll<HTMLElement>(`[data-src-start-line="${change.sourceLine}"]`);
  if (candidates.length === 0) {
    return null;
  }
  if (change.targetKind) {
    for (const candidate of candidates) {
      if (candidate.dataset.targetKind === change.targetKind) {
        return candidate;
      }
    }
  }
  return candidates[0] ?? null;
}

function insertHost(host: HTMLElement, block: HTMLElement): void {
  // Table rows can't have arbitrary children and inserting between rows breaks
  // table layout, so anchor the thread below the whole table instead.
  if (block.tagName === 'TR') {
    const table = block.closest('table');
    const overflowWrapper = table?.parentElement?.classList.contains('overflow-x-auto') ? table.parentElement : null;
    const anchor = overflowWrapper ?? table;
    anchor?.insertAdjacentElement('afterend', host);
    return;
  }
  // List items render their thread as a block child after the bullet text so
  // the connector reads as belonging to the bullet rather than the whole list.
  if (block.tagName === 'LI') {
    block.appendChild(host);
    return;
  }
  block.insertAdjacentElement('afterend', host);
}
