import { describe, expect, it } from 'bun:test';
import { parseSkill } from './parser.ts';

describe('parseSkill', () => {
  it('extracts frontmatter and body', () => {
    const source = `---
name: open
description: Open a thing for review.
---

# Body heading

Body content.
`;
    const skill = parseSkill(source);

    expect(skill.frontmatter.name).toBe('open');
    expect(skill.frontmatter.description).toBe('Open a thing for review.');
    expect(skill.body).toBe('# Body heading\n\nBody content.\n');
  });

  it('rejects sources without YAML frontmatter', () => {
    expect(() => parseSkill('# No frontmatter here\n')).toThrow(/frontmatter/i);
  });

  it('rejects unknown top-level frontmatter keys', () => {
    const source = `---
name: open
description: Valid.
unexpected: nope
---

body
`;
    expect(() => parseSkill(source)).toThrow(/unrecognized/i);
  });

  it('rejects names that violate the agentskills.io constraints', () => {
    const source = `---
name: NotKebab
description: Valid.
---

body
`;
    expect(() => parseSkill(source)).toThrow();
  });

  it('parses optional metadata field', () => {
    const source = `---
name: open
description: Valid.
metadata:
  author: contextbridge-ai
  version: "1.0"
---

body
`;
    const skill = parseSkill(source);
    expect(skill.frontmatter.metadata).toEqual({ author: 'contextbridge-ai', version: '1.0' });
  });
});
