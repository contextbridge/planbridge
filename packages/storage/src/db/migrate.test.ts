import { describe, expect, test } from 'bun:test';
import { migrate as drizzleMigrate } from 'drizzle-orm/bun-sqlite/migrator';
import { withDb } from '#src/testHelpers/index.ts';
import { storageMigrationsJournal, storageMigrationsTable } from './migrations.ts';

describe('storage migrations', () => {
  test('migrates a fresh database and records applied migrations', async () => {
    await withDb(({ sqlite }) => {
      const expectedTables = [
        'plan_versions',
        'projects',
        'review_comments',
        'review_sessions',
        'review_submissions',
        'review_threads',
      ];

      const rows = sqlite.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'").all();
      expect(
        rows
          .map(({ name }) => name)
          .filter((name) => expectedTables.includes(name))
          .sort(),
      ).toEqual(expectedTables);
      expect(
        sqlite.query<{ count: number }, []>(`SELECT count(*) as count FROM ${storageMigrationsTable}`).get()?.count,
      ).toBe(storageMigrationsJournal.length);
    });
  });

  test('can be run more than once', async () => {
    await withDb(({ db, sqlite }) => {
      drizzleMigrate(db, { migrationsJournal: storageMigrationsJournal, migrationsTable: storageMigrationsTable });

      expect(
        sqlite.query<{ count: number }, []>(`SELECT count(*) as count FROM ${storageMigrationsTable}`).get()?.count,
      ).toBe(storageMigrationsJournal.length);
    });
  });
});
