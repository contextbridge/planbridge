import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fm from 'front-matter';
import { z } from 'zod';

// Mirrors the agentskills.io frontmatter spec: https://agentskills.io/specification
export const SkillFrontmatterSchema = z
  .object({
    name: z
      .string()
      .max(64)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase kebab-case; no leading, trailing, or consecutive hyphens'),
    description: z.string().trim().nonempty().max(1024),
    license: z.string().optional(),
    compatibility: z.string().max(500).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    'allowed-tools': z.string().optional(),
  })
  .strict();

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface Skill {
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
}

export function parseSkill(source: string): Skill {
  const parsed = fm<unknown>(source);
  if (!parsed.frontmatter) {
    throw new Error('SKILL.md source missing required YAML frontmatter block');
  }
  const frontmatter = SkillFrontmatterSchema.parse(parsed.attributes);
  return { frontmatter, body: parsed.body };
}

export function loadAllFrom(sourcesDir: string): Skill[] {
  return Array.from(new Bun.Glob('*/SKILL.md').scanSync(sourcesDir))
    .map((relPath) => relPath.split('/')[0] ?? '')
    .filter((dirName) => dirName.length > 0 && !dirName.startsWith('_'))
    .sort((a, b) => a.localeCompare(b))
    .map((dirName) => loadOne(sourcesDir, dirName));
}

function loadOne(sourcesDir: string, dirName: string): Skill {
  const skill = parseSkill(readFileSync(join(sourcesDir, dirName, 'SKILL.md'), 'utf8'));
  if (skill.frontmatter.name !== dirName) {
    throw new Error(
      `directory name '${dirName}' does not match frontmatter name '${skill.frontmatter.name}' (per agentskills.io spec)`,
    );
  }
  return skill;
}
