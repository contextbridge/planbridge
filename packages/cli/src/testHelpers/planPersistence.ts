import type { PlanRepository, PlanSnapshot } from '@contextbridge/storage';
import { expect } from 'bun:test';

const PLAN_ID_PATTERN = /PlanBridge Plan ID: `(plan_[0-9a-f-]+)`/;

export interface PersistedReviewRow {
  readonly planId: string;
  readonly projectRoot: string;
  readonly content: string;
  readonly status: string;
}

export function extractPlanId(output: string): string {
  const match = output.match(PLAN_ID_PATTERN);
  expect(match).not.toBeNull();
  return match![1]!;
}

export function loadPersistedPlan(planRepository: PlanRepository, planId: string): PlanSnapshot {
  const result = planRepository.getPlan(planId);
  if (result.isErr()) throw result.error;
  if (!result.value) throw new Error(`Expected persisted plan ${planId}`);
  return result.value;
}

export function loadOnlyPersistedReview(planRepository: PlanRepository, projectRoot = '/work'): PersistedReviewRow {
  const result = planRepository.listPlans({ projectRoot });
  if (result.isErr()) throw result.error;

  expect(result.value).toHaveLength(1);
  const plan = result.value[0]!;
  expect(plan.revisions).toHaveLength(1);
  const revision = plan.revisions[0]!;

  return {
    planId: plan.id,
    projectRoot: plan.projectRoot,
    content: revision.content,
    status: revision.status,
  };
}
