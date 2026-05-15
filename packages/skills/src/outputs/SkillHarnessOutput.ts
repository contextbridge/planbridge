import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillRenderableHarness } from '@contextbridge/harness';
import { ResultAsync, errAsync, fromThrowable } from 'neverthrow';
import { render } from '#src/render.ts';
import type { Skill } from '#src/skills.ts';
import { GeneratedOutput, type RenderTarget } from './GeneratedOutput.ts';
import { outDirFor } from './paths.ts';

const safeReaddir = fromThrowable((dir: string) => readdirSync(dir, { withFileTypes: true }));

export class SkillHarnessOutput extends GeneratedOutput {
  readonly id: string;
  readonly outputDir: string;
  private readonly harness: SkillRenderableHarness;

  constructor(harness: SkillRenderableHarness) {
    super();
    this.harness = harness;
    this.id = harness.id;
    this.outputDir = outDirFor(harness);
  }

  findOrphans(expectedPaths: ReadonlySet<string>): string[] {
    return safeReaddir(this.outputDir)
      .unwrapOr([])
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(this.outputDir, entry.name))
      .filter((dir) => !expectedPaths.has(join(dir, 'SKILL.md')));
  }

  protected targetFor(skill: Skill): ResultAsync<RenderTarget, Error> {
    const path = join(this.outputDir, this.harness.skillRendering.installName(skill.frontmatter.name), 'SKILL.md');
    const rendered = render(skill, this.harness);
    if (rendered.isErr()) return errAsync(rendered.error);
    return this.formatTarget(path, rendered.value, this.harness);
  }
}
