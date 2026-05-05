import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { getOrCreateAnonymousId } from './anonymousId.ts';

describe('getOrCreateAnonymousId', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cb-anonid-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('creates a new UUID under $XDG_CONFIG_HOME on first call', () => {
    const env = { XDG_CONFIG_HOME: root };
    const id = getOrCreateAnonymousId(env);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const stored = readFileSync(join(root, 'contextbridge', 'anonymous_id'), 'utf8').trim();
    expect(stored).toBe(id);
  });

  it('returns the same id on subsequent calls', () => {
    const env = { XDG_CONFIG_HOME: root };
    const first = getOrCreateAnonymousId(env);
    const second = getOrCreateAnonymousId(env);
    expect(second).toBe(first);
  });

  it('falls back to ~/.config when XDG_CONFIG_HOME is unset', () => {
    const env = { HOME: root };
    const id = getOrCreateAnonymousId(env);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const stored = readFileSync(join(root, '.config', 'contextbridge', 'anonymous_id'), 'utf8').trim();
    expect(stored).toBe(id);
  });
});
