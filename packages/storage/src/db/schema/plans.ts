import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './timestamps.ts';

export const plans = sqliteTable('plans', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title'),
  ...timestamps,
});
