import { Temporal } from '@contextbridge/shared/time';
import { describe, expect, it } from 'bun:test';
import type { Database } from './db/index.ts';
import { PlanRepository } from './PlanRepositoryImpl.ts';
import { expectOk, initialPlanInput, planRevisionInput, withDb } from './testHelpers/index.ts';

const CREATED_AT = Temporal.Instant.from('2026-05-21T16:00:00Z');

interface TimestampRow {
  readonly createdAt: string;
  readonly updatedAt: string;
}

describe('PlanRepositoryImpl', () => {
  it('persists and loads an initial changes-requested plan revision', async () => {
    await withDb(({ db }) => {
      const repository = createRepository(db);
      const input = initialPlanInput.build();

      const result = expectOk(repository.createInitialPlan(input));

      expect(result.planId).toMatch(/^plan_[0-9a-f-]+$/);
      expect(result.revisionId).toMatch(/^revision_[0-9a-f-]+$/);

      const loaded = expectOk(repository.getPlan(result.planId));
      expect(loaded).toMatchObject({
        id: result.planId,
        projectRoot: input.projectRoot,
        status: input.status,
        approvedPlanRevisionId: null,
        revisions: [
          {
            id: result.revisionId,
            sequence: 1,
            sourcePath: input.sourcePath,
            content: input.content,
            status: input.status,
          },
        ],
      });
    });
  });

  it('records approved revision metadata when the first revision is approved', async () => {
    await withDb(({ db }) => {
      const repository = createRepository(db);
      const input = initialPlanInput.build({ content: '# Approved plan', sourcePath: undefined, status: 'approved' });

      const result = expectOk(repository.createInitialPlan(input));

      const loaded = expectOk(repository.getPlan(result.planId));
      expect(loaded).toMatchObject({
        id: result.planId,
        status: 'approved',
        approvedPlanRevisionId: result.revisionId,
        revisions: [
          {
            id: result.revisionId,
            sourcePath: null,
            status: 'approved',
          },
        ],
      });
    });
  });

  it('creates a revision of an existing plan with the next sequence', async () => {
    await withDb(({ db }) => {
      const repository = createRepository(db);
      const initial = expectOk(
        repository.createInitialPlan(
          initialPlanInput.build({ content: '# Initial plan', sourcePath: undefined, status: 'changes_requested' }),
        ),
      );

      const revision = expectOk(
        repository.createRevision(
          planRevisionInput.build({
            planId: initial.planId,
            content: '# Revised plan',
            sourcePath: '/work/project/revised.md',
            status: 'approved',
          }),
        ),
      );

      expect(revision.planId).toBe(initial.planId);
      expect(revision.revisionId).toMatch(/^revision_[0-9a-f-]+$/);

      const loaded = expectOk(repository.getPlan(initial.planId));
      expect(loaded).toMatchObject({
        status: 'approved',
        approvedPlanRevisionId: revision.revisionId,
        revisions: [
          { id: initial.revisionId, sequence: 1, content: '# Initial plan', status: 'changes_requested' },
          {
            id: revision.revisionId,
            sequence: 2,
            sourcePath: '/work/project/revised.md',
            content: '# Revised plan',
            status: 'approved',
          },
        ],
      });
    });
  });

  it('returns null when the plan id is unknown', async () => {
    await withDb(({ db }) => {
      const repository = createRepository(db);

      const loaded = expectOk(repository.getPlan('plan_missing'));

      expect(loaded).toBeNull();
    });
  });

  it('fails when creating a revision for an unknown plan', async () => {
    await withDb(({ db }) => {
      const repository = createRepository(db);

      const failed = repository.createRevision(
        planRevisionInput.build({ planId: 'plan_missing', content: '# Missing parent', status: 'changes_requested' }),
      );

      expect(failed.isErr()).toBe(true);
      expect(expectOk(repository.getPlan('plan_missing'))).toBeNull();
    });
  });

  it('lists plans for a project root through repository snapshots', async () => {
    await withDb(({ db }) => {
      const repository = createRepository(db);
      const first = expectOk(repository.createInitialPlan(initialPlanInput.build({ projectRoot: '/work/one' })));
      expectOk(repository.createInitialPlan(initialPlanInput.build({ projectRoot: '/work/two' })));
      const revision = expectOk(
        repository.createRevision(
          planRevisionInput.build({ planId: first.planId, content: '# Revised plan', status: 'approved' }),
        ),
      );

      const plans = expectOk(repository.listPlans({ projectRoot: '/work/one' }));

      expect(plans).toHaveLength(1);
      expect(plans[0]).toMatchObject({
        id: first.planId,
        projectRoot: '/work/one',
        status: 'approved',
        approvedPlanRevisionId: revision.revisionId,
        revisions: [
          { id: first.revisionId, sequence: 1 },
          { id: revision.revisionId, sequence: 2, content: '# Revised plan', status: 'approved' },
        ],
      });
    });
  });

  it('returns an empty list for project roots with no plans', async () => {
    await withDb(({ db }) => {
      const repository = createRepository(db);
      expectOk(repository.createInitialPlan(initialPlanInput.build({ projectRoot: '/work/one' })));

      expect(expectOk(repository.listPlans({ projectRoot: '/work/missing' }))).toEqual([]);
    });
  });

  it('stores timestamps from the injected clock', async () => {
    await withDb(({ db, sqlite }) => {
      const repository = createRepository(db);

      const result = expectOk(repository.createInitialPlan(initialPlanInput.build()));

      const planTimestamps = sqlite
        .query<
          TimestampRow,
          [string]
        >('select created_at as createdAt, updated_at as updatedAt from plans where id = ?1')
        .get(result.planId);
      const revisionTimestamps = sqlite
        .query<
          TimestampRow,
          [string]
        >('select created_at as createdAt, updated_at as updatedAt from plan_revisions where id = ?1')
        .get(result.revisionId);
      expect(planTimestamps).toEqual({ createdAt: CREATED_AT.toString(), updatedAt: CREATED_AT.toString() });
      expect(revisionTimestamps).toEqual({ createdAt: CREATED_AT.toString(), updatedAt: CREATED_AT.toString() });
    });
  });

  it('enforces unique revision sequences per plan in SQLite', async () => {
    await withDb(({ db, sqlite }) => {
      const repository = createRepository(db);
      const result = expectOk(repository.createInitialPlan(initialPlanInput.build()));

      expect(() => {
        sqlite
          .query(
            `insert into plan_revisions (id, plan_id, sequence, source_path, content, status, created_at, updated_at)
             values ('revision_duplicate', ?1, 1, null, '# Duplicate', 'changes_requested', ?2, ?2)`,
          )
          .run(result.planId, CREATED_AT.toString());
      }).toThrow(/UNIQUE constraint failed/);
    });
  });

  it('allows the same revision sequence for different plans', async () => {
    await withDb(({ db }) => {
      const repository = createRepository(db);

      const first = expectOk(repository.createInitialPlan(initialPlanInput.build()));
      const second = expectOk(repository.createInitialPlan(initialPlanInput.build({ projectRoot: '/work/other' })));

      expect(expectOk(repository.getPlan(first.planId))?.revisions[0]?.sequence).toBe(1);
      expect(expectOk(repository.getPlan(second.planId))?.revisions[0]?.sequence).toBe(1);
    });
  });

  it('cascades plan deletes to revisions in SQLite', async () => {
    await withDb(({ db, sqlite }) => {
      const repository = createRepository(db);
      const result = expectOk(repository.createInitialPlan(initialPlanInput.build()));

      sqlite.query('delete from plans where id = ?1').run(result.planId);

      const revisionCount = sqlite
        .query<{ count: number }, [string]>('select count(*) as count from plan_revisions where plan_id = ?1')
        .get(result.planId)?.count;
      expect(revisionCount).toBe(0);
    });
  });
});

function createRepository(db: Database): PlanRepository {
  return new PlanRepository({ db, clock: () => CREATED_AT });
}
