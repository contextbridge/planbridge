import assert from 'node:assert';
import { getHarness } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { render, renderCommand } from './render.ts';
import { parseSkill } from './skills.ts';

const claude = getHarness('claude');
const codex = getHarness('codex');

describe('renderCommand(skill, claude)', () => {
  it('omits the source name from command frontmatter', () => {
    const source = `---
name: planbridge-open
description: Open a thing.
---

# Body

Some content.
`;
    const result = renderCommand(parseSkill(source), claude);

    assert(result.isOk());
    expect(result.value).toMatchInlineSnapshot(`
      "---
      description: Open a thing.
      ---

      # Body

      Some content.
      "
    `);
    expect(result.value).not.toContain('name:');
  });
});

describe('render(skill, codex)', () => {
  it('preserves the public frontmatter name', () => {
    const canonical = parseSkill(`---
name: planbridge-open
description: Open a thing.
---

body
`);
    const result = render(canonical, codex);

    assert(result.isOk());
    expect(result.value).toMatchInlineSnapshot(`
      "---
      name: planbridge-open
      description: Open a thing.
      ---

      body
      "
    `);
  });

  it('only applies the harness install name to the frontmatter name field', () => {
    const canonical = parseSkill(`---
name: planbridge-open
description: "Open a thing. The description mentions name: something as part of its prose."
---

body
`);
    const result = render(canonical, codex);

    assert(result.isOk());
    expect(result.value).toMatchInlineSnapshot(`
      "---
      name: planbridge-open
      description: "Open a thing. The description mentions name: something as part of its prose."
      ---

      body
      "
    `);
  });

  it('returns an error when the harness has no skill rendering rules', () => {
    const canonical = parseSkill(`---
name: planbridge-open
description: Open.
---

body
`);
    const result = render(canonical, claude);

    assert(result.isErr());
    expect(result.error.message).toMatch(/no skill rendering rules/);
  });
});

describe('render(skill, …) template evaluation', () => {
  it('evaluates an eq-based conditional against the harness id', () => {
    const source = `---
name: planbridge-open
description: Open a thing.
---

Pre.

{{#if (eq harness.id "codex")}}codex-only{{else}}other-harness{{/if}}

Post.
`;
    const skill = parseSkill(source);
    const codexResult = render(skill, codex);
    const claudeResult = renderCommand(skill, claude);

    assert(codexResult.isOk());
    assert(claudeResult.isOk());
    expect(codexResult.value).toContain('codex-only');
    expect(codexResult.value).not.toContain('other-harness');
    expect(claudeResult.value).toContain('other-harness');
    expect(claudeResult.value).not.toContain('codex-only');
  });

  it('renders command bodies without any template directives byte-equivalent to the source body', () => {
    const source = `---
name: planbridge-open
description: Open a thing.
---

Plain markdown with no directives.
`;
    const result = renderCommand(parseSkill(source), claude);

    assert(result.isOk());
    expect(result.value).toMatchInlineSnapshot(`
      "---
      description: Open a thing.
      ---

      Plain markdown with no directives.
      "
    `);
  });

  it('expands partials registered from sources/_partials/', () => {
    const source = `---
name: planbridge-open
description: Open a thing.
---

Before.

{{> codex/sandbox-escalation}}

After.
`;
    const result = render(parseSkill(source), codex);

    assert(result.isOk());
    expect(result.value).toContain('## Running this from Codex');
    expect(result.value).toContain('sandbox_permissions: "require_escalated"');
  });

  it('omits content cleanly when a partial reference is wrapped in a false conditional', () => {
    const source = `---
name: planbridge-open
description: Open a thing.
---

Before.

{{#if (eq harness.id "codex")}}
{{> codex/sandbox-escalation}}
{{/if}}

After.
`;
    const result = renderCommand(parseSkill(source), claude);

    assert(result.isOk());
    expect(result.value).not.toContain('Running this from Codex');
    expect(result.value).not.toContain('sandbox_permissions');
    expect(result.value).not.toMatch(/\{\{/);
    expect(result.value).toContain('Before.\n');
    expect(result.value).toContain('After.\n');
  });

  it('returns a clear error when a template references a missing partial', () => {
    const source = `---
name: planbridge-open
description: Open a thing.
---

{{> codex/does-not-exist}}
`;
    const result = render(parseSkill(source), codex);

    assert(result.isErr());
    expect(result.error.message).toMatch(/planbridge-open.*codex\/does-not-exist/);
  });
});
