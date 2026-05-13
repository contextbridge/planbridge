import { sql } from 'drizzle-orm';
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { timestamps } from './timestamps.ts';

export const PROJECT_VCS_KIND_VALUES = ['none', 'git'] as const;

export const projects = sqliteTable(
  'projects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    path: text('path').notNull(),
    displayName: text('display_name').notNull(),
    vcsKind: text('vcs_kind', { enum: PROJECT_VCS_KIND_VALUES }).notNull(),
    vcsRootPath: text('vcs_root_path'),
    gitRemoteUrl: text('git_remote_url'),
    gitRepositoryId: text('git_repository_id'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_projects_path').on(table.path),
    index('idx_projects_display_name').on(table.displayName),
    check(
      'projects_vcs_none_no_metadata',
      sql`${table.vcsKind} != 'none' OR (${table.vcsRootPath} IS NULL AND ${table.gitRemoteUrl} IS NULL AND ${table.gitRepositoryId} IS NULL)`,
    ),
  ],
);
