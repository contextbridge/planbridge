import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatToMillis } from 'drizzle-orm/migrator.utils';

export interface StorageMigrationEntry {
  readonly name: string;
  readonly timestamp: number;
  readonly sql: string;
}

export function loadStorageMigrations(): StorageMigrationEntry[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const drizzleDir = join(here, '..', '..', 'generated', 'drizzle');

  return readdirSync(drizzleDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const timestamp = formatToMillis(name.slice(0, 14));
      if (!Number.isSafeInteger(timestamp)) {
        throw new Error(`Invalid Drizzle migration directory name: ${name}`);
      }
      return {
        name,
        timestamp,
        sql: readFileSync(join(drizzleDir, name, 'migration.sql'), 'utf8'),
      };
    });
}
