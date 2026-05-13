import { getHarness } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { parseSkill } from './parser.ts';
import { render } from './render.ts';

const claude = getHarness('claude');
const codex = getHarness('codex');

describe('render(skill, claude)', () => {
  it('preserves the source byte-for-byte', () => {
    const source = `---
name: open
description: Open a thing.
---

# Body

Some content.
`;
    expect(render(parseSkill(source), claude)).toBe(source);
  });
});

describe('render(skill, codex)', () => {
  it('rewrites the frontmatter name with the planbridge- prefix', () => {
    const canonical = parseSkill(`---
name: open
description: Open a thing.
---

body
`);
    expect(render(canonical, codex)).toMatchInlineSnapshot(`
      "---
      name: planbridge-open
      description: Open a thing.
      ---

      body
      "
    `);
  });

  it('only rewrites the name field, leaving other frontmatter lines untouched', () => {
    const canonical = parseSkill(`---
name: open
description: "Open a thing. The description mentions name: something as part of its prose."
---

body
`);
    expect(render(canonical, codex)).toMatchInlineSnapshot(`
      "---
      name: planbridge-open
      description: "Open a thing. The description mentions name: something as part of its prose."
      ---

      body
      "
    `);
  });

  it('throws when the harness has no skill rendering rules', () => {
    const canonical = parseSkill(`---
name: open
description: Open.
---

body
`);
    expect(() => render(canonical, getHarness('gemini'))).toThrow(/no skill rendering rules/);
  });
});
