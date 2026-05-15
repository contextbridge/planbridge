import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getHarness } from '@contextbridge/harness';
import { ResultAsync, errAsync, fromThrowable } from 'neverthrow';
import { renderCommand } from '#src/render.ts';
import type { Skill } from '#src/skills.ts';
import { GeneratedOutput, type RenderTarget } from './GeneratedOutput.ts';
import { REPO_ROOT } from './paths.ts';

const safeReaddir = fromThrowable((dir: string) => readdirSync(dir, { withFileTypes: true }));

export class ClaudeCommandOutput extends GeneratedOutput {
  readonly id = 'claude-command';
  readonly harness = getHarness('claude');
  readonly outputDir = join(REPO_ROOT, 'harnessIntegrations/claude/commands');

  findOrphans(expectedPaths: ReadonlySet<string>): string[] {
    return safeReaddir(this.outputDir)
      .unwrapOr([])
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => join(this.outputDir, entry.name))
      .filter((path) => !expectedPaths.has(path));
  }

  protected targetFor(skill: Skill): ResultAsync<RenderTarget, Error> {
    const path = join(this.outputDir, `${skill.frontmatter.name}.md`);
    const rendered = renderCommand(skill, this.harness);
    if (rendered.isErr()) return errAsync(rendered.error);
    return this.formatTarget(path, rendered.value, this.harness);
  }
}
