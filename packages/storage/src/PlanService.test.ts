import { describe, expect, test } from 'bun:test';
import { planRevisions, plans } from './db/schema/index.ts';
import { PlanNotFoundError, PlanService } from './PlanService.ts';
import { withDb } from './testHelpers/index.ts';

describe('PlanService', () => {
  test('creates and sequences revisions for explicit plan IDs', async () => {
    await withDb(async ({ db }) => {
      const service = new PlanService(db);
      const first = await service.createRevision({ sourcePath: '/abs/plan.md', content: '# v1', title: 'Plan' });
      if (first.isErr()) return;

      const second = await service.createRevision({ planId: first.value.planId, content: '# v2', title: null });
      if (second.isErr()) return;

      expect(second.value).toMatchObject({
        planId: first.value.planId,
        revisionNumber: 2,
        previousRevisionId: first.value.revisionId,
      });

      expect(db.select().from(plans).all()).toHaveLength(1);

      expect(
        db.select({ content: planRevisions.content }).from(planRevisions).orderBy(planRevisions.revisionNumber).all(),
      ).toEqual([{ content: '# v1' }, { content: '# v2' }]);
    });
  });

  test('explicit unknown plan IDs fail', async () => {
    await withDb(async ({ db }) => {
      const service = new PlanService(db);
      const result = await service.createRevision({ planId: 'missing', content: '# plan', title: null });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(PlanNotFoundError);
      expect(db.select().from(plans).all()).toHaveLength(0);
      expect(db.select().from(planRevisions).all()).toHaveLength(0);
    });
  });

  test('explicit plan IDs update plan title and store revision metadata', async () => {
    await withDb(async ({ db }) => {
      const service = new PlanService(db);
      const first = (
        await service.createRevision({ sourcePath: '/abs/old.md', content: '# v1', title: 'Old' })
      )._unsafeUnwrap();
      await service.createRevision({ planId: first.planId, sourcePath: '/abs/new.md', content: '# v2', title: 'New' });

      expect(db.select().from(plans).get()).toMatchObject({
        id: first.planId,
        title: 'New',
      });
      expect(
        db
          .select({ title: planRevisions.title, sourcePath: planRevisions.sourcePath })
          .from(planRevisions)
          .orderBy(planRevisions.revisionNumber)
          .all(),
      ).toEqual([
        { title: 'Old', sourcePath: '/abs/old.md' },
        { title: 'New', sourcePath: '/abs/new.md' },
      ]);
    });
  });

  test('query helpers return revision content', async () => {
    await withDb(async ({ db }) => {
      const service = new PlanService(db);
      const first = (await service.createRevision({ content: '# v1', title: null }))._unsafeUnwrap();
      await service.createRevision({ planId: first.planId, content: '# v2', title: null });

      await service.getLatestRevision(first.planId).match(
        (revision) => expect(revision).toMatchObject({ planId: first.planId, revisionNumber: 2, content: '# v2' }),
        (error) => expect(error).toBeUndefined(),
      );
      await service.getPreviousRevision(first.planId, 2).match(
        (revision) => expect(revision).toMatchObject({ id: first.revisionId, content: '# v1' }),
        (error) => expect(error).toBeUndefined(),
      );
    });
  });

  test('implicit sourcePath submissions have independent counters', async () => {
    await withDb(async ({ db }) => {
      const service = new PlanService(db);
      const left = (
        await service.createRevision({ sourcePath: '/abs/a.md', content: '# a', title: null })
      )._unsafeUnwrap();
      const right = (
        await service.createRevision({ sourcePath: '/abs/b.md', content: '# b', title: null })
      )._unsafeUnwrap();

      expect(left.planId).not.toBe(right.planId);
      expect(left.revisionNumber).toBe(1);
      expect(right.revisionNumber).toBe(1);
      expect(db.select().from(plans).all()).toHaveLength(2);
    });
  });
});
