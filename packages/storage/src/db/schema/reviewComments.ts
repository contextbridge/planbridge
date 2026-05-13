import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { reviewThreads } from './reviewThreads.ts';
import { timestamps } from './timestamps.ts';

export const REVIEW_COMMENT_AUTHOR_KIND_VALUES = ['user', 'assistant', 'system'] as const;

export const reviewComments = sqliteTable(
  'review_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    threadId: text('thread_id')
      .notNull()
      .references(() => reviewThreads.id, { onDelete: 'cascade' }),
    authorKind: text('author_kind', { enum: REVIEW_COMMENT_AUTHOR_KIND_VALUES }).notNull(),
    body: text('body').notNull(),
    ...timestamps,
  },
  (table) => [index('idx_review_comments_thread_created').on(table.threadId, table.createdAt)],
);
