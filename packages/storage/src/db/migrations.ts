import type { MigrationsJournal } from 'drizzle-orm/migrator';
import { loadStorageMigrations } from './loadMigrations.macro.ts' with { type: 'macro' };

export const storageMigrationsTable = '_contextbridge_migrations';
export const storageMigrationsJournal = loadStorageMigrations() satisfies MigrationsJournal;
