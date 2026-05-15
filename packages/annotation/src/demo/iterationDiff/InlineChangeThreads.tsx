import { type RefObject, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { InlineChangeThread } from './InlineChangeThread.tsx';
import { findIterationChangeElement, isInlineChange } from './iterationChangeAnchors.tsx';
import type { IterationChange } from './iterationChanges.tsx';

export interface InlineChangeThreadsProps {
  contentRef: RefObject<HTMLDivElement | null>;
  changes: IterationChange[];
}

export function InlineChangeThreads({ contentRef, changes }: InlineChangeThreadsProps) {
  const [hosts, setHosts] = useState<Map<string, HTMLElement>>(new Map());

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    const next = new Map<string, HTMLElement>();
    const inserted: HTMLElement[] = [];

    for (const change of changes) {
      if (!isInlineChange(change)) {
        continue;
      }
      const block = findIterationChangeElement(content, change);
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
        return createPortal(<InlineChangeThread change={change} />, host, id);
      })}
    </>
  );
}

function insertHost(host: HTMLElement, block: HTMLElement): void {
  if (block.tagName === 'TR') {
    const table = block.closest('table');
    const overflowWrapper = table?.parentElement?.classList.contains('overflow-x-auto') ? table.parentElement : null;
    const anchor = overflowWrapper ?? table;
    anchor?.insertAdjacentElement('afterend', host);
    return;
  }

  if (block.tagName === 'LI') {
    block.appendChild(host);
    return;
  }

  block.insertAdjacentElement('afterend', host);
}
