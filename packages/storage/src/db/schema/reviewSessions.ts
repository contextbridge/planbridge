import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { projects } from './projects.ts';
import { timestamps } from './timestamps.ts';

export const REVIEW_SESSION_KIND_VALUES = ['plan_review', 'code_review'] as const;
export const REVIEW_SESSION_STATUS_VALUES = ['active', 'approved', 'changes_requested', 'closed', 'abandoned'] as const;

export const reviewSessions = sqliteTable(
  'review_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: REVIEW_SESSION_KIND_VALUES }).notNull(),
    externalSessionId: text('external_session_id'),
    transcriptPath: text('transcript_path'),
    title: text('title'),
    status: text('status', { enum: REVIEW_SESSION_STATUS_VALUES }).notNull(),
    closedAt: text('closed_at'),
    ...timestamps,
  },
  (table) => [
    index('idx_review_sessions_project_kind_status').on(table.projectId, table.kind, table.status),
    index('idx_review_sessions_external').on(table.projectId, table.kind, table.externalSessionId),
    index('idx_review_sessions_updated_at').on(table.updatedAt),
  ],
);
