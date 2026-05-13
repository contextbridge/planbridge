import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';
import { bundledSkills } from './bundledSkills.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

describe('bundled skills', () => {
  it('has at least one registered skill', () => {
    expect(bundledSkills.length).toBeGreaterThan(0);
  });

  for (const { name, body } of bundledSkills) {
    it(`embedded ${name} skill matches the Claude plugin SKILL.md except for the Codex command name`, () => {
      const claudeSource = readFileSync(join(repoRoot, 'harnessIntegrations/claude/skills', name, 'SKILL.md'), 'utf8');
      expect(body).toBe(claudeSource.replace(`name: ${name}`, `name: planbridge-${name}`));
      expect(body).toContain(`name: planbridge-${name}`);
    });
  }
});
