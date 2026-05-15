import { DOCS_URL, GITHUB_REPO_URL, SLACK_COMMUNITY_URL } from '@contextbridge/shared/links';
import { Header } from '@contextbridge/ui/components/Header';
import 'highlight.js/styles/github-dark.css';
import { useRef, useState } from 'react';
import '../../codeHighlightStyles.css';
import { MarkdownPlan } from '../../MarkdownPlan.tsx';
import { usePlanAppContext } from '../../useAppContext.ts';
import { InlineChangeThreads } from './InlineChangeThreads.tsx';
import { IterationChangeIndicators } from './IterationChangeIndicators.tsx';
import type { IterationChange } from './iterationChanges.ts';
import { IterationChangesSidebar } from './IterationChangesSidebar.tsx';
import './iterationDiffStyles.css';

export const iterationDiffStageTestIds = {
  container: 'iteration-diff-stage',
};

export interface IterationDiffStageProps {
  planContent: string;
  planTitle: string;
  iterationLabel: string;
  changes: IterationChange[];
}

export function IterationDiffStage({ planContent, planTitle, iterationLabel, changes }: IterationDiffStageProps) {
  const { buildInfo } = usePlanAppContext();
  const planRef = useRef<HTMLDivElement | null>(null);
  const [activeChangeId, setActiveChangeId] = useState<string | null>(null);
  const removed = changes.filter((change) => change.kind === 'removed');

  const handleChangeActivate = (changeId: string) => {
    setActiveChangeId(changeId);
    scrollChangeIntoView(planRef.current, changes, changeId);
  };

  const handleChangeHover = (changeId: string, hovered: boolean) => {
    setActiveChangeId(hovered ? changeId : null);
  };

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
        <div className="mx-auto max-w-[88rem] px-4 py-4 sm:px-6 sm:py-6">
          <div
            className={
              removed.length > 0 ? 'grid grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)] gap-8' : 'mx-auto max-w-3xl'
            }
          >
            <section className="min-w-0 pl-4">
              <div className="relative">
                <MarkdownPlan containerRef={planRef} content={planContent} />
                <IterationChangeIndicators
                  changes={changes}
                  contentRef={planRef}
                  activeChangeId={activeChangeId}
                  onActivate={handleChangeActivate}
                  onHoverChange={handleChangeHover}
                />
                <InlineChangeThreads
                  changes={changes}
                  contentRef={planRef}
                  activeChangeId={activeChangeId}
                  onHoverChange={handleChangeHover}
                />
              </div>
            </section>

            {removed.length > 0 ? <IterationChangesSidebar iterationLabel={iterationLabel} removed={removed} /> : null}
          </div>
        </div>
      </main>
    </>
  );
}

function scrollChangeIntoView(content: HTMLElement | null, changes: IterationChange[], changeId: string): void {
  if (!content) {
    return;
  }
  const change = changes.find((candidate) => candidate.id === changeId);
  if (!change || change.sourceLine === undefined) {
    return;
  }
  const candidates = content.querySelectorAll<HTMLElement>(`[data-src-start-line="${change.sourceLine}"]`);
  const element = change.targetKind
    ? Array.from(candidates).find((node) => node.dataset.targetKind === change.targetKind)
    : candidates[0];
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
