import type { AnnotationTargetKind } from '@contextbridge/shared/planReviewSchema';

export type IterationChangeKind = 'modified' | 'added' | 'removed' | 'reordered';

export interface FeedbackReference {
  author: string;
  body: string;
}

export interface IterationChange {
  id: string;
  kind: IterationChangeKind;
  // Line in the v2 markdown source. Undefined for "removed" — there is no
  // anchor in the document, so it surfaces only as a doc-level entry.
  sourceLine?: number;
  // When the same source line hosts multiple matchable elements (e.g. a list
  // item that contains a paragraph), targetKind disambiguates.
  targetKind?: AnnotationTargetKind;
  summary: string;
  feedbackRef?: FeedbackReference;
}

export const iterationChanges: IterationChange[] = [
  {
    id: 'chg_goals_zod',
    kind: 'modified',
    sourceLine: 8,
    targetKind: 'list-item',
    summary: 'Reworded the schema goal to commit to legacy-payload compatibility.',
    feedbackRef: {
      author: 'You',
      body: 'Does the new Zod schema accept the same legacy cookie payloads we issue today?',
    },
  },
  {
    id: 'chg_plan_doc_order',
    kind: 'modified',
    sourceLine: 21,
    targetKind: 'list-item',
    summary: 'Moved the doc step to run before the verifier swap.',
    feedbackRef: {
      author: 'You',
      body: 'Why does the doc step happen after the verifier swap instead of before it?',
    },
  },
  {
    id: 'chg_plan_killswitch_bullet',
    kind: 'added',
    sourceLine: 24,
    targetKind: 'list-item',
    summary: 'Added an explicit kill-switch flag, separate from the rollout flag.',
    feedbackRef: {
      author: 'You',
      body: 'The plan never says how rollback works if the verifier swap causes issues.',
    },
  },
  {
    id: 'chg_table_admin_row',
    kind: 'modified',
    sourceLine: 50,
    targetKind: 'table-row',
    summary: 'Spelled out that admin error messages survive the cutover via an adapter.',
    feedbackRef: {
      author: 'You',
      body: 'Will admin tooling keep its bespoke error messages after the cutover?',
    },
  },
  {
    id: 'chg_rollout_killswitch_para',
    kind: 'added',
    sourceLine: 57,
    targetKind: 'block',
    summary: 'Added kill-switch thresholds and ownership.',
    feedbackRef: {
      author: 'You',
      body: 'The plan never says how rollback works if the verifier swap causes issues.',
    },
  },
  {
    id: 'chg_stage1_tighten',
    kind: 'modified',
    sourceLine: 61,
    targetKind: 'block',
    summary: 'Tightened the Stage 1 description — no semantic change.',
  },
  {
    id: 'chg_success_reorder',
    kind: 'reordered',
    sourceLine: 75,
    targetKind: 'block',
    summary: 'Moved Success criteria above Open questions so the criteria land before the unresolved items.',
  },
  {
    id: 'chg_removed_fallback_q',
    kind: 'removed',
    summary:
      'Dropped the “how long do we keep the legacy verifier” open question — the new kill-switch and 7-day fallback wording answer it.',
    feedbackRef: {
      author: 'You',
      body: 'How long do we keep the legacy verifier around once the flag flips in production?',
    },
  },
  {
    id: 'chg_removed_runbook_owner_q',
    kind: 'removed',
    summary: 'Dropped the runbook-ownership open question — addressed by the new "kill-switch owned by SRE" line.',
  },
];
