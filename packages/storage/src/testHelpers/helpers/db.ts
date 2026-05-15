import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CreateDbResult, createDb } from '#src/db/index.ts';

export interface DbContext extends CreateDbResult {
  readonly dbPath: string;
  readonly tempDir: string;
}

export async function withDb<T>(work: (context: DbContext) => T | Promise<T>): Promise<T> {
  const tempDir = mkdtempSync(join(tmpdir(), 'contextbridge-storage-'));
  const dbPath = join(tempDir, 'db.sqlite');
  const result = createDb({ dbPath });

  if (result.isErr()) {
    rmSync(tempDir, { recursive: true, force: true });
    throw result.error;
  }

  const storage = result.value;
  try {
    return await work({ ...storage, dbPath, tempDir });
  } finally {
    storage.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}
