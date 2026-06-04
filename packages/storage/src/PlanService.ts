import { type Instant, instantToString, nowInstant } from '@contextbridge/shared/time';
import { and, desc, eq } from 'drizzle-orm';
import { type Result, ResultAsync, err, ok } from 'neverthrow';
import type { Database, Transaction } from './db/index.ts';
import { planRevisions, plans } from './db/schema/index.ts';
import { StorageError, toStorageError } from './storageError.ts';

export interface CreatePlanRevisionArgs {
  readonly planId?: string;
  readonly sourcePath?: string;
  readonly content: string;
  readonly title: string | null;
}

export interface CreatePlanRevisionResponse {
  readonly planId: string;
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly previousRevisionId: string | null;
}

export interface PlanRevision {
  readonly id: string;
  readonly planId: string;
  readonly revisionNumber: number;
  readonly content: string;
  readonly title: string | null;
  readonly sourcePath: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class PlanNotFoundError extends Error {
  constructor(planId: string) {
    super(`Plan not found: ${planId}`);
    this.name = 'PlanNotFoundError';
  }
}

const planRevisionProjection = {
  id: planRevisions.id,
  planId: planRevisions.planId,
  revisionNumber: planRevisions.revisionNumber,
  content: planRevisions.content,
  title: planRevisions.title,
  sourcePath: planRevisions.sourcePath,
  createdAt: planRevisions.createdAt,
  updatedAt: planRevisions.updatedAt,
};

export class PlanService {
  constructor(
    private readonly db: Database,
    private readonly deps: { readonly clock: () => Instant } = { clock: nowInstant },
  ) {}

  createRevision(
    args: CreatePlanRevisionArgs,
  ): ResultAsync<CreatePlanRevisionResponse, StorageError | PlanNotFoundError> {
    return ResultAsync.fromPromise(
      Promise.resolve().then(() => createRevision(this.db, this.deps.clock, args)),
      toPlanRevisionError('Failed to create plan revision'),
    ).andThen((result) => result);
  }

  getLatestRevision(planId: string): ResultAsync<PlanRevision | null, StorageError> {
    const { db } = this;
    return ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const revision = db
          .select(planRevisionProjection)
          .from(planRevisions)
          .where(eq(planRevisions.planId, planId))
          .orderBy(desc(planRevisions.revisionNumber))
          .limit(1)
          .get();
        return revision ?? null;
      }),
      toStorageError('Failed to get latest plan revision'),
    );
  }

  getRevision(planId: string, revisionNumber: number): ResultAsync<PlanRevision | null, StorageError> {
    const { db } = this;
    return ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const revision = db
          .select(planRevisionProjection)
          .from(planRevisions)
          .where(and(eq(planRevisions.planId, planId), eq(planRevisions.revisionNumber, revisionNumber)))
          .limit(1)
          .get();
        return revision ?? null;
      }),
      toStorageError('Failed to get plan revision'),
    );
  }

  getPreviousRevision(planId: string, revisionNumber: number): ResultAsync<PlanRevision | null, StorageError> {
    return this.getRevision(planId, revisionNumber - 1);
  }
}

function createRevision(
  db: Database,
  clock: () => Instant,
  args: CreatePlanRevisionArgs,
): Result<CreatePlanRevisionResponse, StorageError | PlanNotFoundError> {
  return db.transaction((tx) => {
    const now = instantToString(clock());
    return getOrCreatePlan(tx, args, now).andThen((plan) => {
      const latest = tx
        .select({ id: planRevisions.id, revisionNumber: planRevisions.revisionNumber })
        .from(planRevisions)
        .where(eq(planRevisions.planId, plan.id))
        .orderBy(desc(planRevisions.revisionNumber))
        .limit(1)
        .get();

      const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
      const revision = tx
        .insert(planRevisions)
        .values({
          planId: plan.id,
          revisionNumber,
          content: args.content,
          title: args.title,
          sourcePath: args.sourcePath ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: planRevisions.id })
        .get();

      if (!revision) return err(new StorageError('Failed to create plan revision'));

      return ok({
        planId: plan.id,
        revisionId: revision.id,
        revisionNumber,
        previousRevisionId: latest?.id ?? null,
      });
    });
  });
}

function getOrCreatePlan(
  tx: Transaction,
  args: CreatePlanRevisionArgs,
  now: string,
): Result<{ readonly id: string }, StorageError | PlanNotFoundError> {
  const { planId, title } = args;

  if (!planId) {
    const created = tx
      .insert(plans)
      .values({ title, createdAt: now, updatedAt: now })
      .returning({ id: plans.id })
      .get();
    return created ? ok(created) : err(new StorageError('Failed to create plan'));
  }

  const existing = tx.select({ id: plans.id }).from(plans).where(eq(plans.id, planId)).limit(1).get();
  if (!existing) return err(new PlanNotFoundError(planId));

  tx.update(plans)
    .set({ ...(title ? { title } : {}), updatedAt: now })
    .where(eq(plans.id, planId))
    .run();

  return ok(existing);
}

function toPlanRevisionError(message: string): (cause: unknown) => StorageError | PlanNotFoundError {
  return (cause) => {
    if (cause instanceof PlanNotFoundError) return cause;
    return cause instanceof StorageError ? cause : new StorageError(message, { cause });
  };
}
