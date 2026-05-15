import { describe, expect, it } from 'bun:test';
import {
  HARNESSES,
  INSTALLABLE_HARNESSES,
  SKILL_RENDERABLE_HARNESSES,
  getHarness,
  getInstallableHarness,
} from './registry.ts';
import type { HarnessId } from './types.ts';

describe('HARNESSES', () => {
  it('lists every HarnessId exactly once', () => {
    const ids: HarnessId[] = ['claude', 'codex', 'gemini', 'cursor', 'aider', 'opencode', 'aether'];
    expect(HARNESSES.map((h) => h.id).sort()).toEqual([...ids].sort());
  });

  it('claude has no skill rendering rules', () => {
    const claude = getHarness('claude');
    expect(claude.skillRendering).toBeUndefined();
  });

  it('codex installs skills with the public source name', () => {
    const codex = getHarness('codex');
    expect(codex.skillRendering?.installName('planbridge-open')).toBe('planbridge-open');
    expect(codex.skillRendering?.destDir).toBe('harnessIntegrations/codex/skills');
  });
});

describe('INSTALLABLE_HARNESSES', () => {
  it('contains only harnesses we install into', () => {
    expect(INSTALLABLE_HARNESSES.map((h) => h.id).sort()).toEqual(['claude', 'codex']);
  });

  it('every entry has installUrl narrowed to string', () => {
    for (const harness of INSTALLABLE_HARNESSES) {
      expect(typeof harness.installUrl).toBe('string');
    }
  });
});

describe('SKILL_RENDERABLE_HARNESSES', () => {
  it('contains only harnesses with rendering rules', () => {
    expect(SKILL_RENDERABLE_HARNESSES.map((h) => h.id)).toEqual(['codex']);
  });
});

describe('getHarness', () => {
  it('returns the descriptor for a known id', () => {
    expect(getHarness('claude').displayName).toBe('Claude Code');
  });

  it('throws for an unknown id', () => {
    expect(() => getHarness('unknown' as HarnessId)).toThrow();
  });
});

describe('getInstallableHarness', () => {
  it('returns the installable descriptor for an installable id', () => {
    expect(getInstallableHarness('claude').installUrl).toContain('docs.claude.com');
  });

  it('throws for a detection-only harness', () => {
    expect(() => getInstallableHarness('gemini')).toThrow();
  });
});
