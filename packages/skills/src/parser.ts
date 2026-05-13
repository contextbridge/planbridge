import fm from 'front-matter';
import { type CanonicalSkill, SkillFrontmatterSchema } from './skillSchema.ts';

export function parseSkill(source: string): CanonicalSkill {
  const parsed = fm<unknown>(source);
  if (!parsed.frontmatter) {
    throw new Error('SKILL.md source missing required YAML frontmatter block');
  }
  const frontmatter = SkillFrontmatterSchema.parse(parsed.attributes);
  return { frontmatter, body: parsed.body };
}
