import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { timestamps } from './timestamps.ts';

export const PROJECT_VCS_KIND_VALUES = ['none', 'git'] as const;

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    path: text('path').notNull(),
    displayName: text('display_name').notNull(),
    vcsKind: text('vcs_kind', { enum: PROJECT_VCS_KIND_VALUES }).notNull(),
    vcsRootPath: text('vcs_root_path'),
    gitRemoteUrl: text('git_remote_url'),
    gitRepositoryId: text('git_repository_id'),
    ...timestamps,
  },
  (table) => [uniqueIndex('uq_projects_path').on(table.path), index('idx_projects_display_name').on(table.displayName)],
);
