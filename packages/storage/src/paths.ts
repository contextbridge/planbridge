import { chmodSync, mkdirSync } from 'node:fs';
import { homedir as defaultHomedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { Result } from 'neverthrow';
import { StorageError, toStorageError } from './storageError.ts';

export interface ResolveStoragePathOptions {
  readonly env: Partial<Record<'CONTEXTBRIDGE_DB_PATH' | 'XDG_DATA_HOME' | 'HOME', string | undefined>>;
  readonly platform: NodeJS.Platform;
  readonly homedir?: () => string;
}

export function resolveStoragePath(options: ResolveStoragePathOptions): string {
  const { env, platform, homedir = defaultHomedir } = options;
  const { CONTEXTBRIDGE_DB_PATH: dbPath, XDG_DATA_HOME: xdgDataHome, HOME: homeFromEnv } = env;

  if (dbPath && dbPath.length > 0) {
    return dbPath;
  }

  const home = homeFromEnv && homeFromEnv.length > 0 ? homeFromEnv : homedir();

  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'contextbridge', 'db.sqlite');
  }

  if (xdgDataHome && isAbsolute(xdgDataHome)) {
    return join(xdgDataHome, 'contextbridge', 'db.sqlite');
  }

  return join(home, '.local', 'share', 'contextbridge', 'db.sqlite');
}

export function ensureStorageDirectory(dbPath: string): Result<void, StorageError> {
  return Result.fromThrowable(
    () => {
      const directory = dirname(dbPath);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      chmodSync(directory, 0o700);
    },
    toStorageError(`Failed to create storage directory for ${dbPath}`),
  )();
}
