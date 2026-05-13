import { text } from 'drizzle-orm/sqlite-core';

export const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};
