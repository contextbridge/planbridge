import type { HarnessDescriptor } from '@contextbridge/harness';
import { stringify as yamlStringify } from 'yaml';
import type { Skill } from './skills.ts';

export function render(skill: Skill, harness: HarnessDescriptor): string {
  const rules = harness.skillRendering;
  if (!rules) {
    throw new Error(`Harness ${harness.id} has no skill rendering rules`);
  }
  const frontmatter = { ...skill.frontmatter, name: rules.installName(skill.frontmatter.name) };
  const frontmatterText = yamlStringify(frontmatter, { lineWidth: 0 });
  return `---\n${frontmatterText}---\n\n${skill.body}`;
}
