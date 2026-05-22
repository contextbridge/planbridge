import { ANNOTATION_STATUS_VALUES } from '@contextbridge/shared/annotationSchema';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { plans } from './plans.ts';
import { timestamps } from './timestamps.ts';

export const planRevisions = sqliteTable(
  'plan_revisions',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    sourcePath: text('source_path'),
    content: text('content').notNull(),
    status: text('status', { enum: ANNOTATION_STATUS_VALUES }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_plan_revisions_plan_sequence').on(table.planId, table.sequence),
    index('idx_plan_revisions_plan_id').on(table.planId),
  ],
);
