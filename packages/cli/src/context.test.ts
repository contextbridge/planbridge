import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resolveProjectRoot } from './context.ts';

describe('resolveProjectRoot', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cb-context-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns the nearest ancestor with a .git directory', () => {
    const root = join(tmp, 'repo');
    const nested = join(root, 'packages', 'cli');
    mkdirSync(join(root, '.git'), { recursive: true });
    mkdirSync(nested, { recursive: true });

    expect(resolveProjectRoot(nested)).toBe(root);
  });

  it('returns the nearest ancestor with a .git file for worktrees', () => {
    const root = join(tmp, 'worktree');
    const nested = join(root, 'src');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, '.git'), 'gitdir: /tmp/common/worktrees/example\n');

    expect(resolveProjectRoot(nested)).toBe(root);
  });

  it('falls back to cwd outside a Git checkout', () => {
    const cwd = join(tmp, 'standalone');
    mkdirSync(cwd, { recursive: true });

    expect(resolveProjectRoot(cwd)).toBe(cwd);
  });
});
