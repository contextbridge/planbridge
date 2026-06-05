import type { InboxActionState, InboxItem, InboxItemKind } from '@contextbridge/shared/inboxSchema';

export interface SectionConfig {
  readonly key: string;
  readonly heading: string;
  readonly parent: InboxItemKind;
  readonly states: readonly InboxActionState[];
  /**
   * Optional custom predicate. When set, items must also satisfy this predicate
   * to be included in the section. Used for sections that filter by non-action-state
   * criteria (e.g. dependabot author).
   */
  readonly predicate?: (item: InboxItem) => boolean;
}

const PR_STATES: readonly InboxActionState[] = [
  'needs_my_review',
  'changes_requested',
  'ci_failing',
  'conflicts',
  'ready_to_merge',
  'waiting_on_others',
] as const;

export const SECTIONS: readonly SectionConfig[] = [
  {
    key: 'needs_my_review',
    heading: 'Needs My Review',
    parent: 'pull_request',
    states: ['needs_my_review'],
    predicate: (item) => !isDependabot(item.author.login),
  },
  {
    key: 'my_prs',
    heading: 'My PRs',
    parent: 'pull_request',
    states: ['changes_requested', 'ci_failing', 'conflicts', 'ready_to_merge', 'waiting_on_others'],
    predicate: (item) => !isDependabot(item.author.login),
  },
  {
    key: 'dependabot',
    heading: 'Dependabot',
    parent: 'pull_request',
    states: PR_STATES,
    predicate: (item) => isDependabot(item.author.login),
  },
  {
    key: 'assigned_issues',
    heading: 'Assigned to You',
    parent: 'issue',
    states: ['assigned_issue'],
  },
];

export const PARENT_LABELS: Record<InboxItemKind, string> = {
  pull_request: 'Pull Requests',
  issue: 'Issues',
} as const;

export function getSection(key: string): SectionConfig {
  const section = SECTIONS.find((s) => s.key === key);
  if (!section) throw new Error(`Unknown section key: ${key}`);
  return section;
}

export function filterItemsBySection(items: readonly InboxItem[], sectionKey: string): InboxItem[] {
  const section = getSection(sectionKey);
  return items.filter((item) => {
    if (!(section.states as readonly string[]).includes(item.actionState)) return false;
    if (section.predicate && !section.predicate(item)) return false;
    return true;
  });
}

export function getParentKind(sectionKey: string): InboxItemKind {
  return getSection(sectionKey).parent;
}

export function countBySection(items: readonly InboxItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const section of SECTIONS) {
    const count = items.filter((item) => {
      if (!(section.states as readonly string[]).includes(item.actionState)) return false;
      if (section.predicate && !section.predicate(item)) return false;
      return true;
    }).length;
    if (count > 0) counts[section.key] = count;
  }
  return counts;
}

export function isDependabot(login: string): boolean {
  return login === 'dependabot' || login === 'dependabot[bot]';
}
