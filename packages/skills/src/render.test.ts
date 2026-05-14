import { getHarness } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { render } from './render.ts';
import { parseSkill } from './skills.ts';

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

describe('render(skill, …) template evaluation', () => {
  it('evaluates an eq-based conditional against the harness id', () => {
    const source = `---
name: open
description: Open a thing.
---

Pre.

{{#if (eq harness.id "codex")}}codex-only{{else}}other-harness{{/if}}

Post.
`;
    const skill = parseSkill(source);

    expect(render(skill, codex)).toContain('codex-only');
    expect(render(skill, codex)).not.toContain('other-harness');
    expect(render(skill, claude)).toContain('other-harness');
    expect(render(skill, claude)).not.toContain('codex-only');
  });

  it('renders bodies without any template directives byte-equivalent to the source body', () => {
    const source = `---
name: open
description: Open a thing.
---

Plain markdown with no directives.
`;
    expect(render(parseSkill(source), claude)).toBe(source);
  });

  it('expands partials registered from sources/_partials/', () => {
    const source = `---
name: open
description: Open a thing.
---

Before.

{{> codex/sandbox-escalation}}

After.
`;
    const rendered = render(parseSkill(source), codex);

    expect(rendered).toContain('## Running this from Codex');
    expect(rendered).toContain('sandbox_permissions: "require_escalated"');
  });

  it('omits content cleanly when a partial reference is wrapped in a false conditional', () => {
    const source = `---
name: open
description: Open a thing.
---

Before.

{{#if (eq harness.id "codex")}}
{{> codex/sandbox-escalation}}
{{/if}}

After.
`;
    const rendered = render(parseSkill(source), claude);

    expect(rendered).not.toContain('Running this from Codex');
    expect(rendered).not.toContain('sandbox_permissions');
    expect(rendered).not.toMatch(/\{\{/);
    expect(rendered).toContain('Before.\n');
    expect(rendered).toContain('After.\n');
  });

  it('throws a clear error when a template references a missing partial', () => {
    const source = `---
name: open
description: Open a thing.
---

{{> codex/does-not-exist}}
`;
    expect(() => render(parseSkill(source), codex)).toThrow(/open.*codex\/does-not-exist/);
  });
});
