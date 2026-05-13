import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSkill } from './parser.ts';
import type { CanonicalSkill } from './skillSchema.ts';

export function loadAllFrom(sourcesDir: string): CanonicalSkill[] {
  return readdirSync(sourcesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => loadOne(sourcesDir, entry.name));
}

function loadOne(sourcesDir: string, dirName: string): CanonicalSkill {
  const skill = parseSkill(readFileSync(join(sourcesDir, dirName, 'SKILL.md'), 'utf8'));
  if (skill.frontmatter.name !== dirName) {
    throw new Error(
      `directory name '${dirName}' does not match frontmatter name '${skill.frontmatter.name}' (per agentskills.io spec)`,
    );
  }
  return skill;
}
