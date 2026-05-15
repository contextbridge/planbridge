import { DOCS_URL, GITHUB_REPO_URL, SLACK_COMMUNITY_URL } from '@contextbridge/shared/links';
import { Header } from '@contextbridge/ui/components/Header';
import 'highlight.js/styles/github-dark.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import '../../codeHighlightStyles.css';
import { MarkdownPlan } from '../../MarkdownPlan.tsx';
import { usePlanAppContext } from '../../useAppContext.ts';
import { InlineChangeThreads } from './InlineChangeThreads.tsx';
import { IterationAnchoredCommentsSidebar, type ReplyFocusRequest } from './IterationAnchoredCommentsSidebar.tsx';
import { findIterationChangeElement, isInlineChange } from './iterationChangeAnchors.ts';
import { IterationChangeHighlights } from './IterationChangeHighlights.tsx';
import type { IterationChange } from './iterationChanges.ts';
import { IterationChangesSidebar } from './IterationChangesSidebar.tsx';
import { IterationThreadNavigationBar } from './IterationThreadNavigationBar.tsx';
import './iterationDiffStyles.css';

export const iterationDiffStageTestIds = {
  container: 'iteration-diff-stage',
};

export type IterationCommentLayout = 'inline' | 'sidebar';

export interface IterationDiffStageProps {
  planContent: string;
  planTitle: string;
  iterationLabel: string;
  changes: IterationChange[];
  commentLayout?: IterationCommentLayout;
}

interface AnchorResolutionState {
  ready: boolean;
  anchoredChangeIds: Set<string>;
}

type ThreadDirection = -1 | 1;

export function IterationDiffStage({
  planContent,
  planTitle,
  iterationLabel,
  changes,
  commentLayout = 'inline',
}: IterationDiffStageProps) {
  const { buildInfo } = usePlanAppContext();
  const planRef = useRef<HTMLDivElement | null>(null);
  const [anchorResolution, setAnchorResolution] = useState<AnchorResolutionState>({
    ready: false,
    anchoredChangeIds: new Set(),
  });
  const [activeChangeIdState, setActiveChangeId] = useState<string | null>(() => getFirstRespondedChangeId(changes));
  const [replyFocusRequest, setReplyFocusRequest] = useState<ReplyFocusRequest | null>(null);
  const threadChanges = changes.filter((change) => change.comments.length > 0);
  const respondedChanges = threadChanges.filter(hasAssistantResponse);
  const activeChangeId =
    commentLayout === 'sidebar' ? getValidActiveChangeId(activeChangeIdState, respondedChanges) : null;
  const activePosition = activeChangeId ? respondedChanges.findIndex((change) => change.id === activeChangeId) + 1 : 0;
  const showSidebarThreads = commentLayout === 'sidebar';
  const docLevelChanges = changes.filter(
    (change) =>
      change.kind === 'removed' ||
      (anchorResolution.ready && isInlineChange(change) && !anchorResolution.anchoredChangeIds.has(change.id)),
  );
  const showDocLevelSidebar = !showSidebarThreads && docLevelChanges.length > 0;
  const contentGridClass = showSidebarThreads
    ? 'grid grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] gap-8'
    : showDocLevelSidebar
      ? 'grid grid-cols-[minmax(0,1fr)_minmax(14rem,22rem)] gap-8'
      : 'mx-auto max-w-3xl';

  const handleAnchorsResolved = useCallback((anchoredChangeIds: Set<string>) => {
    setAnchorResolution({ ready: true, anchoredChangeIds });
  }, []);

  const navigateThread = (direction: ThreadDirection) => {
    const nextChangeId = getAdjacentChangeId(respondedChanges, activeChangeId, direction);
    if (!nextChangeId) {
      return;
    }
    activateChange(nextChangeId);
  };

  const handleChangeSelect = (changeId: string) => {
    activateChange(changeId);
  };

  const activateChange = (changeId: string) => {
    setActiveChangeId(changeId);
  };

  const focusReplyForChange = (changeId: string) => {
    setReplyFocusRequest((current) => ({
      changeId,
      token: (current?.token ?? 0) + 1,
    }));
  };

  useEffect(() => {
    if (!showSidebarThreads) {
      return;
    }

    const shortcutChanges = getRespondedChanges(changes);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandleThreadShortcut(event)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'c') {
        event.preventDefault();
        if (activeChangeId) {
          focusReplyForChange(activeChangeId);
        }
        return;
      }
      if (key === 'n') {
        event.preventDefault();
        const nextChangeId = getAdjacentChangeId(shortcutChanges, activeChangeId, 1);
        if (nextChangeId) {
          activateChange(nextChangeId);
        }
        return;
      }
      if (key === 'p') {
        event.preventDefault();
        const nextChangeId = getAdjacentChangeId(shortcutChanges, activeChangeId, -1);
        if (nextChangeId) {
          activateChange(nextChangeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeChangeId, changes, showSidebarThreads]);

  useEffect(() => {
    if (!showSidebarThreads || !activeChangeId) {
      return;
    }
    scrollChangeIntoView(planRef.current, changes, activeChangeId);
  }, [activeChangeId, changes, showSidebarThreads]);

  return (
    <>
      <title>{`${planTitle} — PlanBridge`}</title>
      <main className="min-h-screen bg-background text-foreground" data-testid={iterationDiffStageTestIds.container}>
        <Header
          docsHref={DOCS_URL}
          githubRepoHref={GITHUB_REPO_URL}
          slackHelpHref={SLACK_COMMUNITY_URL}
          version={buildInfo.version}
        />
        {showSidebarThreads ? (
          <IterationThreadNavigationBar
            activePosition={activePosition}
            onNext={() => navigateThread(1)}
            onPrevious={() => navigateThread(-1)}
            total={respondedChanges.length}
          />
        ) : null}
        <div className="mx-auto max-w-[88rem] px-4 py-4 sm:px-6 sm:py-6">
          <div className={contentGridClass}>
            <section className="min-w-0 pl-4">
              <div className="relative">
                <MarkdownPlan containerRef={planRef} content={planContent} />
                <IterationChangeHighlights
                  activeChangeId={activeChangeId}
                  changes={changes}
                  contentRef={planRef}
                  onAnchorsResolved={handleAnchorsResolved}
                  onChangeSelect={showSidebarThreads ? handleChangeSelect : undefined}
                />
                {showSidebarThreads ? null : <InlineChangeThreads changes={changes} contentRef={planRef} />}
              </div>
            </section>

            {showSidebarThreads ? (
              <IterationAnchoredCommentsSidebar
                activeChangeId={activeChangeId}
                changes={threadChanges}
                focusReplyRequest={replyFocusRequest}
                onChangeSelect={handleChangeSelect}
              />
            ) : null}

            {showDocLevelSidebar ? (
              <IterationChangesSidebar iterationLabel={iterationLabel} docLevelChanges={docLevelChanges} />
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}

function getRespondedChanges(changes: IterationChange[]): IterationChange[] {
  return changes.filter((change) => change.comments.length > 0).filter(hasAssistantResponse);
}

function hasAssistantResponse(change: IterationChange): boolean {
  return change.comments.some((comment) => comment.authorKind === 'assistant');
}

function getFirstRespondedChangeId(changes: IterationChange[]): string | null {
  return changes.find(hasAssistantResponse)?.id ?? null;
}

function getValidActiveChangeId(activeChangeId: string | null, changes: IterationChange[]): string | null {
  if (activeChangeId && changes.some((change) => change.id === activeChangeId)) {
    return activeChangeId;
  }
  return getFirstRespondedChangeId(changes);
}

function getAdjacentChangeId(
  changes: IterationChange[],
  activeChangeId: string | null,
  direction: ThreadDirection,
): string | null {
  if (changes.length === 0) {
    return null;
  }

  const currentIndex = activeChangeId ? changes.findIndex((change) => change.id === activeChangeId) : -1;
  if (currentIndex === -1) {
    return getChangeIdAt(changes, direction === 1 ? 0 : changes.length - 1);
  }

  const nextIndex = (currentIndex + direction + changes.length) % changes.length;
  return getChangeIdAt(changes, nextIndex);
}

function getChangeIdAt(changes: IterationChange[], index: number): string | null {
  return changes[index]?.id ?? null;
}

function scrollChangeIntoView(content: HTMLElement | null, changes: IterationChange[], changeId: string): void {
  if (!content) {
    return;
  }
  const change = changes.find((candidate) => candidate.id === changeId);
  if (!change || !isInlineChange(change)) {
    return;
  }
  findIterationChangeElement(content, change)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function shouldHandleThreadShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }
  if (isEditableShortcutTarget(event.target)) {
    return false;
  }
  return event.key.toLowerCase() === 'n' || event.key.toLowerCase() === 'p' || event.key.toLowerCase() === 'c';
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || target.matches('input, textarea, select');
}
