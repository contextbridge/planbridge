import { join } from 'node:path';
import { SKILL_RENDERABLE_HARNESSES, type SkillRenderableHarness } from '@contextbridge/harness';
import { toError } from '@contextbridge/shared/errors';
import { Result, ResultAsync, errAsync } from 'neverthrow';
import prettier from 'prettier';
import { render } from '#src/render.ts';
import type { Skill } from '#src/skills.ts';

export const PACKAGE_ROOT = join(import.meta.dirname, '..');
export const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
export const SOURCES_DIR = join(PACKAGE_ROOT, 'sources');

export interface RenderTarget {
  readonly harness: SkillRenderableHarness;
  readonly path: string;
  readonly body: string;
}

export function targetsForAll(skills: readonly Skill[]): ResultAsync<RenderTarget[], Error> {
  return ResultAsync.fromSafePromise(Promise.all(skills.map(targetsFor)))
    .andThen((results) => Result.combine(results))
    .map((targets) => targets.flat());
}

export function targetsFor(skill: Skill): ResultAsync<RenderTarget[], Error> {
  return ResultAsync.fromSafePromise(
    Promise.all(SKILL_RENDERABLE_HARNESSES.map((harness) => targetFor(skill, harness))),
  ).andThen((results) => Result.combine(results));
}

export function outDirFor(harness: SkillRenderableHarness): string {
  return join(REPO_ROOT, harness.skillRendering.destDir);
}

function targetFor(skill: Skill, harness: SkillRenderableHarness): ResultAsync<RenderTarget, Error> {
  const path = join(outDirFor(harness), harness.skillRendering.installName(skill.frontmatter.name), 'SKILL.md');
  const rendered = render(skill, harness);
  if (rendered.isErr()) return errAsync(rendered.error);

  return ResultAsync.fromPromise(prettier.resolveConfig(path), toError)
    .andThen((config) =>
      ResultAsync.fromPromise(prettier.format(rendered.value, { ...config, filepath: path }), toError),
    )
    .map((body) => ({ harness, path, body }));
}
