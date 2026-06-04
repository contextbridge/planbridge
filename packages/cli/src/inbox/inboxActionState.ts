import type { InboxActionState } from '@contextbridge/shared/inboxSchema';

/**
 * Which search bucket surfaced an item. A PR that GitHub returned for
 * `review-requested:@me` is inbound (someone is blocked on my review); a PR
 * returned for `author:@me` is outbound (the ball may be in my court).
 */
export type InboxItemSource = 'review_requested' | 'authored' | 'assigned_issue';

export interface ActionStateInput {
  readonly kind: 'pull_request' | 'issue';
  readonly source: InboxItemSource;
  readonly isDraft: boolean;
  /** GitHub's computed verdict — APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED. */
  readonly reviewDecision: string | undefined;
  /** True when the viewer's own latest review on this PR is an approval. */
  readonly viewerHasApproved: boolean;
  /** statusCheckRollup state — SUCCESS | FAILURE | ERROR | PENDING | EXPECTED. */
  readonly checksState: string | undefined;
  /** mergeable — MERGEABLE | CONFLICTING | UNKNOWN. */
  readonly mergeable: string | undefined;
}

// Sort order: lower rank surfaces first. Mirrors the descending-urgency order of
// the enum and the section order in the UI.
const ACTION_STATE_RANK: Record<InboxActionState, number> = {
  needs_my_review: 0,
  changes_requested: 1,
  ci_failing: 2,
  conflicts: 3,
  ready_to_merge: 4,
  waiting_on_others: 5,
  assigned_issue: 6,
};

export function deriveActionState(input: ActionStateInput): InboxActionState {
  if (input.kind === 'issue') return 'assigned_issue';
  if (input.source === 'authored') return classifyAuthoredPr(input);
  return classifyReviewRequestedPr(input);
}

export function actionStateRank(state: InboxActionState): number {
  return ACTION_STATE_RANK[state];
}

// Someone else's PR that GitHub requested my review on. The PR is only blocked
// on me when GitHub still says a required review is outstanding — once a
// co-CODEOWNER's approval satisfies the rule, reviewDecision flips to APPROVED
// and it drops out of this lane. Drafts and PRs I already approved are not on me.
function classifyReviewRequestedPr(input: ActionStateInput): InboxActionState {
  if (input.isDraft) return 'waiting_on_others';
  if (input.viewerHasApproved) return 'waiting_on_others';
  if (input.reviewDecision === 'REVIEW_REQUIRED') return 'needs_my_review';
  return 'waiting_on_others';
}

// My own PR. Surface it only when the ball is in my court, most-urgent first; a
// PR merely waiting on reviewers (green, no change requests) is not my action.
function classifyAuthoredPr(input: ActionStateInput): InboxActionState {
  if (input.isDraft) return 'waiting_on_others';
  if (input.reviewDecision === 'CHANGES_REQUESTED') return 'changes_requested';
  if (isFailingChecks(input.checksState)) return 'ci_failing';
  if (input.mergeable === 'CONFLICTING') return 'conflicts';
  if (input.reviewDecision === 'APPROVED') return 'ready_to_merge';
  return 'waiting_on_others';
}

function isFailingChecks(state: string | undefined): boolean {
  return state === 'FAILURE' || state === 'ERROR';
}
