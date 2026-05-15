import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { type StoragePathsContext, ensureStorageDirectory, resolveStoragePath } from './paths.ts';

describe('resolveStoragePath', () => {
  test('uses CONTEXTBRIDGE_DB_PATH override exactly', () => {
    expect(
      resolveStoragePath(stubCtx({ CONTEXTBRIDGE_DB_PATH: 'relative/custom.sqlite', HOME: '/home/tester' }), {
        platform: 'linux',
      }),
    ).toBe('relative/custom.sqlite');
  });

  test('uses absolute XDG_DATA_HOME on Linux', () => {
    expect(resolveStoragePath(stubCtx({ XDG_DATA_HOME: '/data', HOME: '/home/tester' }), { platform: 'linux' })).toBe(
      '/data/contextbridge/db.sqlite',
    );
  });

  test('falls back to HOME local share on Linux', () => {
    expect(resolveStoragePath(stubCtx({ HOME: '/home/tester' }), { platform: 'linux' })).toBe(
      '/home/tester/.local/share/contextbridge/db.sqlite',
    );
  });

  test('ignores relative XDG_DATA_HOME values', () => {
    expect(
      resolveStoragePath(stubCtx({ XDG_DATA_HOME: 'relative', HOME: '/home/tester' }), { platform: 'linux' }),
    ).toBe('/home/tester/.local/share/contextbridge/db.sqlite');
  });

  test('uses macOS application support', () => {
    expect(resolveStoragePath(stubCtx({ HOME: '/Users/tester' }), { platform: 'darwin' })).toBe(
      '/Users/tester/Library/Application Support/contextbridge/db.sqlite',
    );
  });

  test('falls back to supplied homedir when HOME is unavailable', () => {
    expect(resolveStoragePath(stubCtx({}), { platform: 'linux', homedir: () => '/fallback' })).toBe(
      '/fallback/.local/share/contextbridge/db.sqlite',
    );
  });
});

describe('ensureStorageDirectory', () => {
  test('creates the parent directory with private permissions when possible', () => {
    const root = mkdtempSync(join(tmpdir(), 'contextbridge-storage-'));
    const dbPath = join(root, 'nested', 'db.sqlite');

    const result = ensureStorageDirectory(dbPath);

    expect(result.isOk()).toBe(true);
    expect(statSync(join(root, 'nested')).mode & 0o777).toBe(0o700);
  });
});

function stubCtx(env: NonNullable<StoragePathsContext['env']>): StoragePathsContext {
  return { env };
}
