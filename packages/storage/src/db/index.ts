import { Database as BunSqliteDatabase } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate as drizzleMigrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Result } from 'neverthrow';
import { ensureStorageDirectory } from '#src/paths.ts';
import { StorageError, toStorageError } from '#src/storageError.ts';
import { storageMigrationsJournal, storageMigrationsTable } from './migrations.ts';
import * as schema from '#src/schema/index.ts';

export interface CreateDbOptions {
  readonly dbPath: string;
}

export interface CreateDbResult {
  readonly db: ReturnType<typeof drizzle<typeof schema>>;
  readonly sqlite: BunSqliteDatabase;
  close(): Result<void, StorageError>;
}

export type Database = CreateDbResult['db'];
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function createDb(options: CreateDbOptions): Result<CreateDbResult, StorageError> {
  const { dbPath } = options;

  return ensureStorageDirectory(dbPath).andThen(() =>
    Result.fromThrowable(
      () => {
        const sqlite = new BunSqliteDatabase(dbPath, { create: true, strict: true });
        sqlite.run('PRAGMA foreign_keys = ON;');
        sqlite.run('PRAGMA journal_mode = WAL;');
        sqlite.run('PRAGMA busy_timeout = 5000;');

        const db = drizzle({ client: sqlite, schema });
        try {
          drizzleMigrate(db, { migrationsJournal: storageMigrationsJournal, migrationsTable: storageMigrationsTable });
        } catch (error) {
          sqlite.close(false);
          throw error;
        }

        return {
          db,
          sqlite,
          close: () =>
            Result.fromThrowable(() => {
              sqlite.run('PRAGMA wal_checkpoint(TRUNCATE);');
              sqlite.close(false);
            }, toStorageError('Failed to close storage database'))(),
        };
      },
      toStorageError(`Failed to create storage database at ${dbPath}`),
    )(),
  );
}
