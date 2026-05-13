import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { planVersions } from './planVersions.ts';
import { reviewSessions } from './reviewSessions.ts';
import { timestamps } from './timestamps.ts';

export const REVIEW_SUBMISSION_STATUS_VALUES = ['approved', 'changes_requested', 'commented'] as const;

export const reviewSubmissions = sqliteTable(
  'review_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => reviewSessions.id, { onDelete: 'cascade' }),
    planVersionId: text('plan_version_id')
      .notNull()
      .references(() => planVersions.id, { onDelete: 'cascade' }),
    status: text('status', { enum: REVIEW_SUBMISSION_STATUS_VALUES }).notNull(),
    submittedAt: text('submitted_at').notNull(),
    payloadSchema: text('payload_schema').notNull(),
    payloadJson: text('payload_json').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_review_submissions_plan_version').on(table.planVersionId),
    index('idx_review_submissions_session_plan_version').on(table.sessionId, table.planVersionId),
    index('idx_review_submissions_submitted_at').on(table.submittedAt),
  ],
);
