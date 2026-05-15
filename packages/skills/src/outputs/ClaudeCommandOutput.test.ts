import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { parseSkill } from '#src/skills.ts';
import { ClaudeCommandOutput } from './ClaudeCommandOutput.ts';

describe('ClaudeCommandOutput', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cb-claude-output-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('renders Claude targets into a flat command markdown path', async () => {
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
        harness: { id: 'claude' },
        path: join(dir, 'planbridge-open.md'),
      },
    ]);
    expect(result.value[0]?.body).not.toContain('name: planbridge-open\n');
    expect(result.value[0]?.body).toContain('description: Open a thing.\n');
  });

  it('detects stale flat command files as orphans', () => {
    const output = outputWithDir(dir);
    const expectedPath = join(dir, 'planbridge-open.md');
    writeFileSync(expectedPath, 'current\n');
    writeFileSync(join(dir, 'old-command.md'), 'stale\n');
    writeFileSync(join(dir, 'README.txt'), 'ignored\n');

    const orphans = output.findOrphans(new Set([expectedPath]));

    expect(orphans).toEqual([join(dir, 'old-command.md')]);
  });
});

function outputWithDir(dir: string): ClaudeCommandOutput {
  const output = new ClaudeCommandOutput();
  Object.assign(output, { outputDir: dir });
  return output;
}
