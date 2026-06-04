import { Temporal } from '@contextbridge/shared/time';
import { describe, expect, it } from 'bun:test';
import { priorityForScore, scoreInboxItem } from './inboxPriority.ts';

describe('priorityForScore', () => {
  it.each([
    { score: 140, priority: 'urgent' },
    { score: 90, priority: 'high' },
    { score: 40, priority: 'normal' },
    { score: 0, priority: 'low' },
  ] as const)('maps $score to $priority', ({ score, priority }) => {
    expect(priorityForScore(score)).toBe(priority);
  });
});

describe('scoreInboxItem', () => {
  it('prioritizes review requests and assignments with reasons', () => {
    const result = scoreInboxItem({
      kind: 'pull_request',
      isDraft: false,
      authorLogin: 'alice',
      viewerLogin: 'octocat',
      assigneeLogins: ['octocat'],
      reviewRequestLogins: ['octocat'],
      updatedAt: Temporal.Now.instant().toString(),
    });

    expect(result).toMatchObject({ priority: 'urgent' });
    expect(result.reasons).toContain('review_requested');
    expect(result.reasons).toContain('assigned_to_me');
  });

  it('lowers Dependabot drafts', () => {
    const result = scoreInboxItem({
      kind: 'pull_request',
      isDraft: true,
      authorLogin: 'dependabot[bot]',
      viewerLogin: 'octocat',
      assigneeLogins: [],
      reviewRequestLogins: [],
      updatedAt: '2020-01-01T00:00:00Z',
    });

    expect(result).toMatchObject({ priority: 'low' });
    expect(result.reasons).toEqual(['dependabot']);
  });
});
