import { join } from 'node:path';
import { SKILL_RENDERABLE_HARNESSES, type SkillRenderableHarness } from '@contextbridge/harness';
import { render } from '#src/render.ts';
import type { CanonicalSkill } from '#src/skillSchema.ts';

export const PACKAGE_ROOT = join(import.meta.dirname, '..');
export const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
export const SOURCES_DIR = join(PACKAGE_ROOT, 'sources');

export interface RenderTarget {
  readonly harness: SkillRenderableHarness;
  readonly path: string;
  readonly body: string;
}

export function targetsFor(skill: CanonicalSkill): RenderTarget[] {
  return SKILL_RENDERABLE_HARNESSES.map((harness) => ({
    harness,
    path: join(outDirFor(harness), harness.skillRendering.installName(skill.frontmatter.name), 'SKILL.md'),
    body: render(skill, harness),
  }));
}

export function outDirFor(harness: SkillRenderableHarness): string {
  return join(REPO_ROOT, harness.skillRendering.outDirFromRepoRoot);
}
