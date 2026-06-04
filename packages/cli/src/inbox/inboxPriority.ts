import type { InboxItem, InboxPriority, InboxReason } from '@contextbridge/shared/inboxSchema';
import { Temporal } from '@contextbridge/shared/time';

export interface InboxPriorityInput {
  readonly kind: InboxItem['kind'];
  readonly isDraft: boolean;
  readonly authorLogin: string;
  readonly viewerLogin: string;
  readonly assigneeLogins: readonly string[];
  readonly reviewRequestLogins: readonly string[];
  readonly updatedAt: string;
  readonly checksConclusion?: string;
}

export interface InboxPriorityResult {
  readonly priority: InboxPriority;
  readonly priorityScore: number;
  readonly reasons: readonly InboxReason[];
}

export function scoreInboxItem(input: InboxPriorityInput): InboxPriorityResult {
  const reasons = new Set<InboxReason>();
  let score = 0;

  if (input.reviewRequestLogins.includes(input.viewerLogin)) {
    reasons.add('review_requested');
    score += 100;
  }

  if (input.assigneeLogins.includes(input.viewerLogin)) {
    reasons.add('assigned_to_me');
    score += 80;
  }

  if (input.authorLogin === input.viewerLogin && input.kind === 'pull_request') {
    reasons.add('authored_by_me_needs_attention');
    score += 40;
  }

  if (isRecent(input.updatedAt)) {
    reasons.add('recent_activity');
    score += 20;
  }

  if (
    isFailingConclusion(input.checksConclusion) &&
    (input.authorLogin === input.viewerLogin || input.assigneeLogins.includes(input.viewerLogin))
  ) {
    reasons.add('ci_failing');
    score += 50;
  }

  if (isDependabot(input.authorLogin)) {
    reasons.add('dependabot');
    score -= 30;
  }

  if (input.isDraft) {
    score -= 60;
  }

  return {
    priority: priorityForScore(score),
    priorityScore: score,
    reasons: Array.from(reasons),
  };
}

export function priorityForScore(score: number): InboxPriority {
  if (score >= 140) return 'urgent';
  if (score >= 90) return 'high';
  if (score >= 40) return 'normal';
  return 'low';
}

function isRecent(updatedAt: string): boolean {
  const updated = Temporal.Instant.from(updatedAt);
  const now = Temporal.Now.instant();
  const ageMs = now.epochMilliseconds - updated.epochMilliseconds;
  return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
}

function isFailingConclusion(value: string | undefined): boolean {
  return value === 'FAILURE' || value === 'TIMED_OUT' || value === 'ACTION_REQUIRED';
}

function isDependabot(login: string): boolean {
  return login === 'dependabot' || login === 'dependabot[bot]';
}
