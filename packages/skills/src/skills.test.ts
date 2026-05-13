import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { stringify as yamlStringify } from 'yaml';
import { loadAllFrom, parseSkill } from './skills.ts';

describe('parseSkill', () => {
  it('extracts frontmatter and body', () => {
    const skill = parseSkill(
      frontmatter({ name: 'open', description: 'Open a thing for review.' }, '# Body heading\n\nBody content.\n'),
    );

    expect(skill.frontmatter.name).toBe('open');
    expect(skill.frontmatter.description).toBe('Open a thing for review.');
    expect(skill.body).toBe('# Body heading\n\nBody content.\n');
  });

  it('rejects sources without YAML frontmatter', () => {
    expect(() => parseSkill('# No frontmatter here\n')).toThrow(/frontmatter/i);
  });

  it('rejects unknown top-level frontmatter keys', () => {
    expect(() =>
      parseSkill(frontmatter({ name: 'open', description: 'Valid.', unexpected: 'nope' }, 'body\n')),
    ).toThrow(/unrecognized/i);
  });

  it('rejects names that violate the agentskills.io constraints', () => {
    expect(() => parseSkill(frontmatter({ name: 'NotKebab', description: 'Valid.' }, 'body\n'))).toThrow();
  });

  it('parses optional metadata field', () => {
    const skill = parseSkill(
      frontmatter(
        { name: 'open', description: 'Valid.', metadata: { author: 'contextbridge-ai', version: '1.0' } },
        'body\n',
      ),
    );
    expect(skill.frontmatter.metadata).toEqual({ author: 'contextbridge-ai', version: '1.0' });
  });
});

describe('loadAllFrom', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cb-skills-loader-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns one skill per `<name>/SKILL.md` entry, alphabetically by directory name', () => {
    mkdirSync(join(dir, 'open'), { recursive: true });
    mkdirSync(join(dir, 'review'), { recursive: true });
    writeFileSync(join(dir, 'open', 'SKILL.md'), frontmatter({ name: 'open', description: 'Open a thing.' }, 'body\n'));
    writeFileSync(
      join(dir, 'review', 'SKILL.md'),
      frontmatter({ name: 'review', description: 'Review a change.' }, 'body\n'),
    );

    const skills = loadAllFrom(dir);

    expect(skills.map((s) => s.frontmatter.name)).toEqual(['open', 'review']);
  });

  it('rejects when a directory name does not match the frontmatter name field', () => {
    mkdirSync(join(dir, 'open'), { recursive: true });
    writeFileSync(
      join(dir, 'open', 'SKILL.md'),
      frontmatter({ name: 'review', description: 'Mismatched name.' }, 'body\n'),
    );

    expect(() => loadAllFrom(dir)).toThrow(/directory name 'open' does not match frontmatter name 'review'/);
  });

  it('returns an empty array when no skills exist', () => {
    expect(loadAllFrom(dir)).toEqual([]);
  });
});

function frontmatter(fields: Record<string, unknown>, body: string): string {
  return `---\n${yamlStringify(fields)}---\n\n${body}`;
}
