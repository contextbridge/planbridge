import { describe, expect, it } from 'bun:test';
import { bundledSkills } from './codex.ts';

describe('bundledSkills', () => {
  it('has at least one registered skill', () => {
    expect(bundledSkills.length).toBeGreaterThan(0);
  });

  for (const skill of bundledSkills) {
    it(`${skill.installId} body contains a matching frontmatter name line`, () => {
      expect(skill.body).toContain(`name: ${skill.installId}\n`);
    });

    it(`${skill.installId} installId starts with planbridge-`, () => {
      expect(skill.installId.startsWith('planbridge-')).toBe(true);
    });
  }
});
