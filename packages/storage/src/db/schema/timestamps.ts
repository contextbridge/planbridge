import { Temporal } from '@contextbridge/shared/time';
import { text } from 'drizzle-orm/sqlite-core';

const nowIso = () => Temporal.Now.instant().toString();

export const timestamps = {
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
};
