import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { reviewSessions } from './reviewSessions.ts';
import { timestamps } from './timestamps.ts';

export const REVIEW_THREAD_SUBJECT_KIND_VALUES = ['global', 'plan_anchor', 'file_range'] as const;
export const REVIEW_THREAD_STATUS_VALUES = ['open', 'resolved', 'stale'] as const;

export const reviewThreads = sqliteTable(
  'review_threads',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => reviewSessions.id, { onDelete: 'cascade' }),
    subjectKind: text('subject_kind', { enum: REVIEW_THREAD_SUBJECT_KIND_VALUES }).notNull(),
    anchorJson: text('anchor_json').notNull(),
    status: text('status', { enum: REVIEW_THREAD_STATUS_VALUES }).notNull(),
    ...timestamps,
  },
  (table) => [index('idx_review_threads_session_status').on(table.sessionId, table.status)],
);
