import type { InboxActionState } from '@contextbridge/shared/inboxSchema';
import { describe, expect, it } from 'bun:test';
import { type ActionStateInput, actionStateRank, deriveActionState } from './inboxActionState.ts';

describe('deriveActionState', () => {
  it('flags a review-requested PR still blocked on a required review', () => {
    expect(deriveActionState(reviewInput({ reviewDecision: 'REVIEW_REQUIRED' }))).toBe('needs_my_review');
  });

  it('drops a review-requested PR once a co-owner approval satisfies the rule', () => {
    // GitHub flips reviewDecision to APPROVED — it is no longer blocked on me.
    expect(deriveActionState(reviewInput({ reviewDecision: 'APPROVED' }))).toBe('waiting_on_others');
  });

  it('drops a review-requested PR I have already approved', () => {
    expect(deriveActionState(reviewInput({ reviewDecision: 'REVIEW_REQUIRED', viewerHasApproved: true }))).toBe(
      'waiting_on_others',
    );
  });

  it('does not ask me to review a draft', () => {
    expect(deriveActionState(reviewInput({ reviewDecision: 'REVIEW_REQUIRED', isDraft: true }))).toBe(
      'waiting_on_others',
    );
  });

  it.each([
    { reviewDecision: 'CHANGES_REQUESTED', expected: 'changes_requested' },
    { checksState: 'FAILURE', expected: 'ci_failing' },
    { mergeable: 'CONFLICTING', expected: 'conflicts' },
    { reviewDecision: 'APPROVED', expected: 'ready_to_merge' },
    { reviewDecision: 'REVIEW_REQUIRED', expected: 'waiting_on_others' },
  ] as const)('classifies my authored PR as $expected', ({ expected, ...over }) => {
    expect(deriveActionState(authoredInput(over))).toBe(expected);
  });

  it('prefers changes-requested over failing CI on my PR', () => {
    expect(deriveActionState(authoredInput({ reviewDecision: 'CHANGES_REQUESTED', checksState: 'FAILURE' }))).toBe(
      'changes_requested',
    );
  });

  it('classifies an assigned issue regardless of PR signals', () => {
    expect(deriveActionState({ ...authoredInput({}), kind: 'issue', source: 'assigned_issue' })).toBe('assigned_issue');
  });

  it('ranks states in descending urgency', () => {
    const order: InboxActionState[] = [
      'needs_my_review',
      'changes_requested',
      'ci_failing',
      'conflicts',
      'ready_to_merge',
      'waiting_on_others',
      'assigned_issue',
    ];
    const ranks = order.map(actionStateRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

function reviewInput(over: Partial<ActionStateInput>): ActionStateInput {
  return {
    kind: 'pull_request',
    source: 'review_requested',
    isDraft: false,
    reviewDecision: undefined,
    viewerHasApproved: false,
    checksState: undefined,
    mergeable: undefined,
    ...over,
  };
}

function authoredInput(over: Partial<ActionStateInput>): ActionStateInput {
  return { ...reviewInput(over), source: 'authored' };
}
