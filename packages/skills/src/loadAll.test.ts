import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { loadAllFrom } from './loadAll.ts';

describe('loadAllFrom', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cb-skills-loader-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns one canonical skill per `<name>/SKILL.md` entry, alphabetically by directory name', () => {
    mkdirSync(join(dir, 'open'), { recursive: true });
    mkdirSync(join(dir, 'review'), { recursive: true });
    writeFileSync(join(dir, 'open', 'SKILL.md'), `---\nname: open\ndescription: Open a thing.\n---\n\nbody\n`);
    writeFileSync(join(dir, 'review', 'SKILL.md'), `---\nname: review\ndescription: Review a change.\n---\n\nbody\n`);

    const skills = loadAllFrom(dir);

    expect(skills.map((s) => s.frontmatter.name)).toEqual(['open', 'review']);
  });

  it('rejects when a directory name does not match the frontmatter name field', () => {
    mkdirSync(join(dir, 'open'), { recursive: true });
    writeFileSync(join(dir, 'open', 'SKILL.md'), `---\nname: review\ndescription: Mismatched name.\n---\n\nbody\n`);

    expect(() => loadAllFrom(dir)).toThrow(/directory name 'open' does not match frontmatter name 'review'/);
  });

  it('returns an empty array when no skills exist', () => {
    expect(loadAllFrom(dir)).toEqual([]);
  });
});
