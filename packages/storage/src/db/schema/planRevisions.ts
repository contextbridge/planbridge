import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { plans } from './plans.ts';
import { timestamps } from './timestamps.ts';

export const planRevisions = sqliteTable(
  'plan_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    revisionNumber: integer('revision_number').notNull(),
    content: text('content').notNull(),
    title: text('title'),
    sourcePath: text('source_path'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_plan_revisions_plan_revision_number').on(table.planId, table.revisionNumber),
    check('plan_revisions_revision_number_positive', sql`${table.revisionNumber} > 0`),
  ],
);
