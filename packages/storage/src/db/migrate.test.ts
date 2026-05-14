import { describe, expect, test } from 'bun:test';
import { migrate as drizzleMigrate } from 'drizzle-orm/bun-sqlite/migrator';
import { withDb } from '#src/testHelpers/index.ts';
import { storageMigrationsJournal, storageMigrationsTable } from './migrations.ts';

describe('storage migrations', () => {
  test('migrates a fresh database and records applied migrations', async () => {
    await withDb(({ sqlite }) => {
      expect(
        sqlite
          .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'")
          .get()?.name,
      ).toBe('projects');
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
