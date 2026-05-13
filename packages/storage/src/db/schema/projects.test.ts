import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { project, withDb } from '#src/testHelpers/index.ts';
import { projects } from './index.ts';

describe('projects table', () => {
  test('stores project metadata', async () => {
    await withDb(async ({ db }) => {
      await db.insert(projects).values(project.build({ displayName: 'PlanBridge' }));

      const rows = await db
        .select({ displayName: projects.displayName, vcsKind: projects.vcsKind })
        .from(projects)
        .where(eq(projects.displayName, 'PlanBridge'));

      expect(rows).toEqual([{ displayName: 'PlanBridge', vcsKind: 'git' }]);
    });
  });

  test('enforces unique project paths', async () => {
    await withDb(async ({ db }) => {
      await db.insert(projects).values(project.build({ path: '/tmp/contextbridge/same-project' }));

      expect(() =>
        db
          .insert(projects)
          .values(project.build({ path: '/tmp/contextbridge/same-project' }))
          .run(),
      ).toThrow();
    });
  });

  test('rejects vcs metadata when vcs_kind is none', async () => {
    await withDb(({ db }) => {
      expect(() =>
        db
          .insert(projects)
          .values(project.build({ vcsKind: 'none', vcsRootPath: '/tmp/contextbridge/leak' }))
          .run(),
      ).toThrow(/CHECK/i);
    });
  });

  test('accepts vcs_kind none when metadata columns are null', async () => {
    await withDb(async ({ db }) => {
      await db.insert(projects).values(
        project.build({
          vcsKind: 'none',
          vcsRootPath: null,
          gitRemoteUrl: null,
          gitRepositoryId: null,
        }),
      );

      const rows = await db.select({ vcsKind: projects.vcsKind }).from(projects);
      expect(rows).toEqual([{ vcsKind: 'none' }]);
    });
  });
});
