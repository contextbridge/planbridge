import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { timestamps } from './timestamps.ts';

export const plans = sqliteTable(
  'plans',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title'),
    sourcePath: text('source_path'),
    ...timestamps,
  },
  (table) => [uniqueIndex('uq_plans_source_path').on(table.sourcePath)],
);
