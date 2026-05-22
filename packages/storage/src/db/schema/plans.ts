import { ANNOTATION_STATUS_VALUES } from '@contextbridge/shared/annotationSchema';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './timestamps.ts';

export const plans = sqliteTable(
  'plans',
  {
    id: text('id').primaryKey(),
    projectRoot: text('project_root').notNull(),
    status: text('status', { enum: ANNOTATION_STATUS_VALUES }).notNull(),
    approvedPlanRevisionId: text('approved_plan_revision_id'),
    ...timestamps,
  },
  (table) => [index('idx_plans_project_root_status').on(table.projectRoot, table.status)],
);
