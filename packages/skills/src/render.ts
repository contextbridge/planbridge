import { join } from 'node:path';
import type { HarnessDescriptor } from '@contextbridge/harness';
import { stringify as yamlStringify } from 'yaml';
import { type HandlebarsEnv, createHandlebars } from './handlebars.ts';
import type { Skill } from './skills.ts';

const PARTIALS_DIR = join(import.meta.dirname, '..', 'sources', '_partials');

export function render(skill: Skill, harness: HarnessDescriptor): string {
  const rules = harness.skillRendering;
  if (!rules) {
    throw new Error(`Harness ${harness.id} has no skill rendering rules`);
  }
  const frontmatter = { ...skill.frontmatter, name: rules.installName(skill.frontmatter.name) };
  const frontmatterText = yamlStringify(frontmatter, { lineWidth: 0 });
  const env = createHandlebars(PARTIALS_DIR);
  const body = compileBody(env, skill, harness);
  return `---\n${frontmatterText}---\n\n${body}`;
}

function compileBody(env: HandlebarsEnv, skill: Skill, harness: HarnessDescriptor): string {
  try {
    return env.compile(skill.body, { noEscape: true })({ harness });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to render skill '${skill.frontmatter.name}' for harness '${harness.id}': ${message}`, {
      cause: err,
    });
  }
}
