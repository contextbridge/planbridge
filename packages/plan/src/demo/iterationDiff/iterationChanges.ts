import type { AnnotationTargetKind } from '@contextbridge/shared/planReviewSchema';

export type IterationChangeKind = 'modified' | 'added' | 'removed' | 'reordered';

export type IterationCommentAuthor = 'user' | 'assistant';

export interface IterationThreadComment {
  id: string;
  author: string;
  authorKind: IterationCommentAuthor;
  body: string;
}

export interface IterationChange {
  id: string;
  kind: IterationChangeKind;
  sourceLine?: number;
  targetKind?: AnnotationTargetKind;
  summary: string;
  comments: IterationThreadComment[];
}

export const iterationChanges: IterationChange[] = [
  {
    id: 'chg_goals_zod',
    kind: 'modified',
    sourceLine: 8,
    targetKind: 'list-item',
    summary: 'Reworded the schema goal to commit to legacy-payload compatibility.',
    comments: thread(
      'chg_goals_zod',
      'Does the new Zod schema accept the same legacy cookie payloads we issue today?',
      'Yes — I changed the goal to state that the Zod schema accepts every currently-issued legacy payload and reports malformed tokens with actionable errors.',
    ),
  },
  {
    id: 'chg_plan_doc_order',
    kind: 'modified',
    sourceLine: 21,
    targetKind: 'list-item',
    summary: 'Moved the doc step to run before the verifier swap.',
    comments: thread(
      'chg_plan_doc_order',
      'Why does the doc step happen after the verifier swap instead of before it?',
      'Good call — I moved the migration-path documentation into step 3 before the verifier replacement so on-call has the runbook first.',
    ),
  },
  {
    id: 'chg_plan_killswitch_bullet',
    kind: 'added',
    sourceLine: 24,
    targetKind: 'list-item',
    summary: 'Added an explicit kill-switch flag, separate from the rollout flag.',
    comments: thread(
      'chg_plan_killswitch_bullet',
      'The plan never says how rollback works if the verifier swap causes issues.',
      'I added a dedicated kill-switch flag to the plan steps so rollback is not coupled to the gradual rollout flag.',
    ),
  },
  {
    id: 'chg_table_admin_row',
    kind: 'modified',
    sourceLine: 50,
    targetKind: 'table-row',
    summary: 'Spelled out that admin error messages survive the cutover via an adapter.',
    comments: thread(
      'chg_table_admin_row',
      'Will admin tooling keep its bespoke error messages after the cutover?',
      'I updated the admin-impersonation row to preserve bespoke errors through a thin adapter while routing through the shared verifier.',
    ),
  },
  {
    id: 'chg_rollout_killswitch_para',
    kind: 'added',
    sourceLine: 57,
    targetKind: 'block',
    summary: 'Added kill-switch thresholds and ownership.',
    comments: thread(
      'chg_rollout_killswitch_para',
      'The plan never says how rollback works if the verifier swap causes issues.',
      'I expanded Rollout with concrete thresholds, automatic legacy fallback, paging, and SRE ownership for the kill-switch.',
    ),
  },
  {
    id: 'chg_stage1_tighten',
    kind: 'modified',
    sourceLine: 61,
    targetKind: 'block',
    summary: 'Tightened the Stage 1 description — no semantic change.',
    comments: thread(
      'chg_stage1_tighten',
      'Stage 1 reads a little wordy — can you tighten it without changing the rollout behavior?',
      'I tightened the Stage 1 wording while preserving the same staging-shadow behavior.',
    ),
  },
  {
    id: 'chg_success_reorder',
    kind: 'reordered',
    sourceLine: 75,
    targetKind: 'block',
    summary: 'Moved Success criteria above Open questions so the criteria land before the unresolved items.',
    comments: thread(
      'chg_success_reorder',
      'Can success criteria come before open questions so the acceptance bar is easier to find?',
      'I moved Success criteria above Open questions so readers see the acceptance bar before unresolved follow-ups.',
    ),
  },
  {
    id: 'chg_nuked_anchor_open_question',
    kind: 'modified',
    sourceLine: 999,
    targetKind: 'list-item',
    summary: 'Answered feedback whose original anchor no longer exists in this version.',
    comments: thread(
      'chg_nuked_anchor_open_question',
      'Can you clarify the monitoring story on the open question about synthetic legacy-cookie checks?',
      'I rewrote that open question during the update, so the exact anchor disappeared. The answer is now tracked as a document-level thread instead of pretending there is still an inline location.',
    ),
  },
  {
    id: 'chg_removed_fallback_q',
    kind: 'removed',
    summary:
      'Dropped the “how long do we keep the legacy verifier” open question — the new kill-switch and 7-day fallback wording answer it.',
    comments: thread(
      'chg_removed_fallback_q',
      'How long do we keep the legacy verifier around once the flag flips in production?',
      'I answered this in Stage 4: keep the old verifier available as a fallback for 7 days after production cutover, then delete it.',
    ),
  },
  {
    id: 'chg_removed_runbook_owner_q',
    kind: 'removed',
    summary: 'Dropped the runbook-ownership open question — addressed by the new "kill-switch owned by SRE" line.',
    comments: thread(
      'chg_removed_runbook_owner_q',
      'Who owns the rollback runbook if the kill-switch trips?',
      'I removed the runbook-owner question because the Rollout section now names SRE as the kill-switch owner.',
    ),
  },
];

function thread(id: string, userBody: string, assistantBody: string): IterationThreadComment[] {
  return [
    {
      id: `${id}_user`,
      author: 'You',
      authorKind: 'user',
      body: userBody,
    },
    {
      id: `${id}_assistant`,
      author: 'Agent',
      authorKind: 'assistant',
      body: assistantBody,
    },
  ];
}
