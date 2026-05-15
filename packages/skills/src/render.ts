import { join } from 'node:path';
import type { HarnessDescriptor } from '@contextbridge/harness';
import { Result } from 'neverthrow';
import { stringify as yamlStringify } from 'yaml';
import { type HandlebarsEnv, createHandlebars } from './handlebars.ts';
import type { Skill } from './skills.ts';

const PARTIALS_DIR = join(import.meta.dirname, '..', 'sources', '_partials');

export function render(skill: Skill, harness: HarnessDescriptor): Result<string, Error> {
  return Result.fromThrowable(
    () => {
      const frontmatterText = yamlStringify(skill.frontmatter, { lineWidth: 0 });
      const env = createHandlebars(PARTIALS_DIR);
      const body = compileBody(env, skill, harness);
      return `---\n${frontmatterText}---\n\n${body}`;
    },
    (cause) => renderError(skill, harness, cause),
  )();
}

function compileBody(env: HandlebarsEnv, skill: Skill, harness: HarnessDescriptor): string {
  return env.compile(skill.body, { noEscape: true })({ harness });
}

function renderError(skill: Skill, harness: HarnessDescriptor, cause: unknown): Error {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new Error(`failed to render skill '${skill.frontmatter.name}' for harness '${harness.id}': ${message}`, {
    cause,
  });
}
