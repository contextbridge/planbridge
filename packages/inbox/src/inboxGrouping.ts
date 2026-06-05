import type { InboxActionState, InboxFilters, InboxItem } from '@contextbridge/shared/inboxSchema';

export interface InboxSection {
  readonly key: string;
  readonly heading: string;
  readonly items: InboxItem[];
}

interface SectionDef {
  readonly key: string;
  readonly heading: string;
  readonly states: readonly InboxActionState[];
}

// Two lanes plus quiet tails. PR-page items land in needs-my-review / my-prs /
// waiting; issue-page items land in assigned. Empty sections are dropped, so a
// page only ever shows the lanes it has items for.
const SECTIONS: readonly SectionDef[] = [
  { key: 'needs_my_review', heading: 'Needs My Review', states: ['needs_my_review'] },
  {
    key: 'my_prs',
    heading: 'My PRs',
    states: ['changes_requested', 'ci_failing', 'conflicts', 'ready_to_merge'],
  },
  { key: 'assigned_issues', heading: 'Assigned to You', states: ['assigned_issue'] },
  { key: 'waiting', heading: 'Waiting on Others', states: ['waiting_on_others'] },
];

export function groupByActionState(items: readonly InboxItem[]): InboxSection[] {
  const byState = new Map<InboxActionState, InboxItem[]>();
  for (const item of items) {
    const bucket = byState.get(item.actionState) ?? [];
    bucket.push(item);
    byState.set(item.actionState, bucket);
  }

  return SECTIONS.map((section) => ({
    key: section.key,
    heading: section.heading,
    items: section.states.flatMap((state) => byState.get(state) ?? []),
  })).filter((section) => section.items.length > 0);
}

// Client-side narrowing applied to the full snapshot. Drafts are hidden unless
// the toggle is on; the repository dropdown narrows to a single repo. Section and
// kind filtering happens separately via `filterItemsBySection`.
export function applyInboxFilters(items: readonly InboxItem[], filters: InboxFilters): InboxItem[] {
  const { repositories, includeDrafts = false } = filters;
  return items.filter((item) => {
    if (!includeDrafts && item.isDraft) return false;
    if (repositories && repositories.length > 0 && !repositories.includes(`${item.owner}/${item.repository}`)) {
      return false;
    }
    return true;
  });
}

export function extractRepositories(items: readonly InboxItem[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const fullName = `${item.owner}/${item.repository}`;
    if (!seen.has(fullName)) seen.add(fullName);
  }
  return Array.from(seen).sort();
}
