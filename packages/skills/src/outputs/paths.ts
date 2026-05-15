import { join } from 'node:path';
import type { SkillRenderableHarness } from '@contextbridge/harness';

export const PACKAGE_ROOT = join(import.meta.dirname, '..', '..');
export const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
export const SOURCES_DIR = join(PACKAGE_ROOT, 'sources');

export function outDirFor(harness: SkillRenderableHarness): string {
  return join(REPO_ROOT, harness.skillRendering.destDir);
}
