import { sql } from 'drizzle-orm';
import { type AnySQLiteColumn, check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { reviewSessions } from './reviewSessions.ts';
import { timestamps } from './timestamps.ts';

export const PLAN_VERSION_CREATED_BY_VALUES = ['assistant', 'user', 'system'] as const;

export const planVersions = sqliteTable(
  'plan_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => reviewSessions.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    parentPlanVersionId: text('parent_plan_version_id').references((): AnySQLiteColumn => planVersions.id, {
      onDelete: 'set null',
    }),
    createdBy: text('created_by', { enum: PLAN_VERSION_CREATED_BY_VALUES }).notNull(),
    contentHash: text('content_hash').notNull(),
    title: text('title'),
    summary: text('summary'),
    markdown: text('markdown').notNull(),
    byteLength: integer('byte_length').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_plan_versions_session_number').on(table.sessionId, table.versionNumber),
    index('idx_plan_versions_session_created').on(table.sessionId, table.createdAt),
    index('idx_plan_versions_parent').on(table.parentPlanVersionId),
    check('plan_versions_version_number_nonnegative', sql`${table.versionNumber} >= 0`),
  ],
);
