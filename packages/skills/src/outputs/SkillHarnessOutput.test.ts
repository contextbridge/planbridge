import assert from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getHarness } from '@contextbridge/harness';
import type { SkillRenderableHarness } from '@contextbridge/harness';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { parseSkill } from '#src/skills.ts';
import { SkillHarnessOutput } from './SkillHarnessOutput.ts';

describe('SkillHarnessOutput', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cb-skill-output-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('renders Codex targets into a directory-backed SKILL.md path', async () => {
    const output = outputWithDir(dir);
    const skill = parseSkill(`---
name: planbridge-open
description: Open a thing.
---

body
`);

    const result = await output.targetsFor([skill]);

    assert(result.isOk());
    expect(result.value).toMatchObject([
      {
        harness: { id: 'codex' },
        path: join(dir, 'planbridge-open', 'SKILL.md'),
      },
    ]);
    expect(result.value[0]?.body).toContain('name: planbridge-open\n');
  });

  it('detects stale skill directories as orphans', () => {
    const output = outputWithDir(dir);
    const expectedPath = join(dir, 'planbridge-open', 'SKILL.md');
    mkdirSync(join(dir, 'planbridge-open'), { recursive: true });
    mkdirSync(join(dir, 'stale-skill'), { recursive: true });
    writeFileSync(expectedPath, 'current\n');
    writeFileSync(join(dir, 'stale-skill', 'SKILL.md'), 'stale\n');

    const orphans = output.findOrphans(new Set([expectedPath]));

    expect(orphans).toEqual([join(dir, 'stale-skill')]);
  });
});

function outputWithDir(dir: string): SkillHarnessOutput {
  const output = new SkillHarnessOutput(getHarness('codex') as SkillRenderableHarness);
  Object.assign(output, { outputDir: dir });
  return output;
}
