import type { InboxItem, InboxPriority } from '@contextbridge/shared/inboxSchema';

export interface PriorityGroup {
  readonly priority: InboxPriority;
  readonly heading: string;
  readonly items: InboxItem[];
}

const PRIORITY_SECTION_ORDER: readonly InboxPriority[] = ['urgent', 'high', 'normal', 'low'];

const SECTION_HEADINGS: Record<InboxPriority, string> = {
  urgent: 'Urgent',
  high: 'Needs Review',
  normal: 'Assigned to Me',
  low: 'Lower Priority',
};

export function groupByPriority(items: readonly InboxItem[]): PriorityGroup[] {
  const buckets = new Map<InboxPriority, InboxItem[]>();

  for (const priority of PRIORITY_SECTION_ORDER) {
    buckets.set(priority, []);
  }

  for (const item of items) {
    const bucket = buckets.get(item.priority);
    if (bucket) bucket.push(item);
  }

  return PRIORITY_SECTION_ORDER.map((priority) => ({
    priority,
    heading: SECTION_HEADINGS[priority],
    items: buckets.get(priority) ?? [],
  })).filter((group) => group.items.length > 0);
}

export function extractRepositories(items: readonly InboxItem[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const fullName = `${item.owner}/${item.repository}`;
    if (!seen.has(fullName)) seen.add(fullName);
  }
  return Array.from(seen).sort();
}
