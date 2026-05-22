import type { AnnotationStatus } from '@contextbridge/shared/annotationSchema';
import type { Instant } from '@contextbridge/shared/time';
import { asc, desc, eq } from 'drizzle-orm';
import { Result } from 'neverthrow';
import type { Database, Transaction } from './db/index.ts';
import { planRevisions, plans } from './db/schema/index.ts';
import { StorageError, toStorageError } from './storageError.ts';

export interface CreateInitialPlanInput {
  readonly projectRoot: string;
  readonly content: string;
  readonly sourcePath?: string;
  readonly status: AnnotationStatus;
}

export interface CreateInitialPlanResult {
  readonly planId: string;
  readonly revisionId: string;
}

export interface CreatePlanRevisionInput {
  readonly planId: string;
  readonly content: string;
  readonly sourcePath?: string;
  readonly status: AnnotationStatus;
}

export interface CreatePlanRevisionResult {
  readonly planId: string;
  readonly revisionId: string;
}

export interface PlanSnapshot {
  readonly id: string;
  readonly projectRoot: string;
  readonly status: AnnotationStatus;
  readonly approvedPlanRevisionId: string | null;
  readonly revisions: readonly PlanRevisionSnapshot[];
}

export interface PlanRevisionSnapshot {
  readonly id: string;
  readonly sequence: number;
  readonly sourcePath: string | null;
  readonly content: string;
  readonly status: AnnotationStatus;
}

export interface ListPlansInput {
  readonly projectRoot?: string;
}

export interface PlanRepositoryImplOptions {
  readonly db: PlanDatabase;
  readonly clock: () => Instant;
}

export type PlanDatabase = Database | Transaction;

export class PlanRepository {
  readonly #db: PlanDatabase;
  readonly #clock: () => Instant;

  constructor(options: PlanRepositoryImplOptions) {
    const { db, clock } = options;
    this.#db = db;
    this.#clock = clock;
  }

  createInitialPlan(input: CreateInitialPlanInput): Result<CreateInitialPlanResult, StorageError> {
    return Result.fromThrowable(() => {
      const now = this.#clock().toString();
      const planId = createPlanId();
      const revisionId = createPlanRevisionId();
      const approvedPlanRevisionId = input.status === 'approved' ? revisionId : null;

      runTransaction(this.#db, (tx) => {
        const planValues = {
          id: planId,
          projectRoot: input.projectRoot,
          status: input.status,
          approvedPlanRevisionId,
          createdAt: now,
          updatedAt: now,
        } satisfies typeof plans.$inferInsert;

        tx.insert(plans).values(planValues).run();

        insertPlanRevision(tx, {
          id: revisionId,
          planId,
          sequence: 1,
          sourcePath: input.sourcePath,
          content: input.content,
          status: input.status,
          now,
        });
      });

      return { planId, revisionId };
    }, toStorageError('Failed to persist initial plan'))();
  }

  createRevision(input: CreatePlanRevisionInput): Result<CreatePlanRevisionResult, StorageError> {
    return Result.fromThrowable(
      () => {
        const now = this.#clock().toString();
        const revisionId = createPlanRevisionId();

        runTransaction(this.#db, (tx) => {
          const [latestRevision] = tx
            .select({ sequence: planRevisions.sequence })
            .from(planRevisions)
            .where(eq(planRevisions.planId, input.planId))
            .orderBy(desc(planRevisions.sequence))
            .limit(1)
            .all();

          const sequence = latestRevision ? latestRevision.sequence + 1 : 1;

          insertPlanRevision(tx, {
            id: revisionId,
            planId: input.planId,
            sequence,
            sourcePath: input.sourcePath,
            content: input.content,
            status: input.status,
            now,
          });

          tx.update(plans)
            .set({
              status: input.status,
              approvedPlanRevisionId: input.status === 'approved' ? revisionId : null,
              updatedAt: now,
            })
            .where(eq(plans.id, input.planId))
            .run();
        });

        return { planId: input.planId, revisionId };
      },
      toStorageError(`Failed to persist plan revision ${input.planId}`),
    )();
  }

  getPlan(planId: string): Result<PlanSnapshot | null, StorageError> {
    return Result.fromThrowable(
      () => {
        const [plan] = this.#db
          .select({
            id: plans.id,
            projectRoot: plans.projectRoot,
            status: plans.status,
            approvedPlanRevisionId: plans.approvedPlanRevisionId,
          })
          .from(plans)
          .where(eq(plans.id, planId))
          .all();

        if (!plan) return null;

        return planSnapshot(this.#db, plan);
      },
      toStorageError(`Failed to load plan ${planId}`),
    )();
  }

  listPlans(input: ListPlansInput = {}): Result<readonly PlanSnapshot[], StorageError> {
    return Result.fromThrowable(() => {
      const { projectRoot } = input;
      const planRows = projectRoot
        ? this.#db
            .select({
              id: plans.id,
              projectRoot: plans.projectRoot,
              status: plans.status,
              approvedPlanRevisionId: plans.approvedPlanRevisionId,
            })
            .from(plans)
            .where(eq(plans.projectRoot, projectRoot))
            .orderBy(asc(plans.createdAt), asc(plans.id))
            .all()
        : this.#db
            .select({
              id: plans.id,
              projectRoot: plans.projectRoot,
              status: plans.status,
              approvedPlanRevisionId: plans.approvedPlanRevisionId,
            })
            .from(plans)
            .orderBy(asc(plans.createdAt), asc(plans.id))
            .all();

      return planRows.map((plan) => planSnapshot(this.#db, plan));
    }, toStorageError('Failed to list plans'))();
  }
}

interface PlanRow {
  readonly id: string;
  readonly projectRoot: string;
  readonly status: AnnotationStatus;
  readonly approvedPlanRevisionId: string | null;
}

interface InsertPlanRevisionInput {
  readonly id: string;
  readonly planId: string;
  readonly sequence: number;
  readonly sourcePath?: string;
  readonly content: string;
  readonly status: AnnotationStatus;
  readonly now: string;
}

function planSnapshot(db: PlanDatabase, plan: PlanRow): PlanSnapshot {
  const revisions = db
    .select({
      id: planRevisions.id,
      sequence: planRevisions.sequence,
      sourcePath: planRevisions.sourcePath,
      content: planRevisions.content,
      status: planRevisions.status,
    })
    .from(planRevisions)
    .where(eq(planRevisions.planId, plan.id))
    .orderBy(asc(planRevisions.sequence))
    .all();

  return { ...plan, revisions };
}

function insertPlanRevision(tx: Transaction, input: InsertPlanRevisionInput): void {
  const revisionValues = {
    id: input.id,
    planId: input.planId,
    sequence: input.sequence,
    sourcePath: input.sourcePath ?? null,
    content: input.content,
    status: input.status,
    createdAt: input.now,
    updatedAt: input.now,
  } satisfies typeof planRevisions.$inferInsert;

  tx.insert(planRevisions).values(revisionValues).run();
}

function createPlanId(): string {
  return `plan_${crypto.randomUUID()}`;
}

function createPlanRevisionId(): string {
  return `revision_${crypto.randomUUID()}`;
}

function runTransaction(db: PlanDatabase, work: (tx: Transaction) => void): void {
  if (canStartTransaction(db)) {
    db.transaction(work);
    return;
  }

  work(db);
}

function canStartTransaction(db: PlanDatabase): db is Database {
  return 'transaction' in db && typeof db.transaction === 'function';
}
