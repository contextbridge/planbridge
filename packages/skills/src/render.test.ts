import assert from 'node:assert';
import { getHarness } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { render } from './render.ts';
import { parseSkill } from './skills.ts';

const claude = getHarness('claude');
const codex = getHarness('codex');

describe('render(skill, claude)', () => {
  it('preserves the source byte-for-byte', () => {
    const source = `---
name: planbridge-open
description: Open a thing.
---

# Body

Some content.
`;
    const result = render(parseSkill(source), claude);

    assert(result.isOk());
    expect(result.value).toBe(source);
  });
});

describe('render(skill, codex)', () => {
  it('preserves the canonical frontmatter name for Codex', () => {
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

  it('preserves frontmatter values that contain `name:` inside their prose', () => {
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
    const claudeResult = render(skill, claude);

    assert(codexResult.isOk());
    assert(claudeResult.isOk());
    expect(codexResult.value).toContain('codex-only');
    expect(codexResult.value).not.toContain('other-harness');
    expect(claudeResult.value).toContain('other-harness');
    expect(claudeResult.value).not.toContain('codex-only');
  });

  it('renders bodies without any template directives byte-equivalent to the source body', () => {
    const source = `---
name: planbridge-open
description: Open a thing.
---

Plain markdown with no directives.
`;
    const result = render(parseSkill(source), claude);

    assert(result.isOk());
    expect(result.value).toBe(source);
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
    const result = render(parseSkill(source), claude);

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
