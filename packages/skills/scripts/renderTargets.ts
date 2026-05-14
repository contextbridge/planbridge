import { join } from 'node:path';
import { SKILL_RENDERABLE_HARNESSES, type SkillRenderableHarness } from '@contextbridge/harness';
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

export async function targetsFor(skill: Skill): Promise<RenderTarget[]> {
  return Promise.all(
    SKILL_RENDERABLE_HARNESSES.map(async (harness) => {
      const path = join(outDirFor(harness), harness.skillRendering.installName(skill.frontmatter.name), 'SKILL.md');
      const config = await prettier.resolveConfig(path);
      const body = await prettier.format(render(skill, harness), { ...config, filepath: path });
      return { harness, path, body };
    }),
  );
}

export function outDirFor(harness: SkillRenderableHarness): string {
  return join(REPO_ROOT, harness.skillRendering.destDir);
}
