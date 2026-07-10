import { describe, expect, it } from 'vitest';
import { findTokenSpan, snapRangeToTokenBoundaries } from './codeTokenSnap.ts';

describe('findTokenSpan', () => {
  it('returns the innermost Shiki token ancestor inside a code-block', () => {
    const container = renderContainer(
      `<pre data-target-kind="code-block" data-target-id="code:0:abc"><code class="shiki"><span class="shiki-token keyword">const</span> <span class="shiki-token variable">foo</span> = <span class="shiki-token number">1</span></code></pre>`,
    );
    const variableSpan = container.querySelector<HTMLElement>('.variable')!;
    const textNode = variableSpan.firstChild!;
    expect(findTokenSpan(textNode, container)).toBe(variableSpan);
  });

  it('returns the innermost token when tokens are nested', () => {
    const container = renderContainer(
      `<pre data-target-kind="code-block"><code class="shiki"><span class="shiki-token string">\`hello <span class="shiki-token substitution">\${<span class="shiki-token variable">who</span>}</span>\`</span></code></pre>`,
    );
    const innerVariable = container.querySelector<HTMLElement>('.variable')!;
    expect(findTokenSpan(innerVariable.firstChild!, container)).toBe(innerVariable);
  });

  it('returns null outside any code-block', () => {
    const container = renderContainer(`<p>plain paragraph <em>emphasized</em> text</p>`);
    const em = container.querySelector('em')!;
    expect(findTokenSpan(em.firstChild!, container)).toBeNull();
  });

  it('returns null for whitespace text nodes between tokens', () => {
    const container = renderContainer(
      `<pre data-target-kind="code-block"><code class="shiki"><span class="shiki-token keyword">const</span> foo</code></pre>`,
    );
    const code = container.querySelector('code')!;
    const whitespaceText = code.childNodes[1]!;
    expect(findTokenSpan(whitespaceText, container)).toBeNull();
  });

  it('returns null for code that is not inside a code-block target', () => {
    const container = renderContainer(
      `<div><code class="shiki"><span class="shiki-token keyword">const</span></code></div>`,
    );
    const keyword = container.querySelector('.keyword')!;
    expect(findTokenSpan(keyword.firstChild!, container)).toBeNull();
  });
});

describe('snapRangeToTokenBoundaries', () => {
  it('widens a selection starting and ending inside the same token', () => {
    const container = renderContainer(
      `<pre data-target-kind="code-block"><code class="shiki">const <span class="shiki-token variable">foobar</span></code></pre>`,
    );
    const variable = container.querySelector('.variable')!;
    const text = variable.firstChild as Text;

    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 3);
    expect(range.toString()).toBe('oo');

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('foobar');
  });

  it('widens both endpoints when a selection spans multiple tokens', () => {
    const container = renderContainer(
      `<pre data-target-kind="code-block"><code class="shiki"><span class="shiki-token keyword">const</span> <span class="shiki-token variable">foobar</span> = <span class="shiki-token number">42</span></code></pre>`,
    );
    const keyword = container.querySelector('.keyword')!;
    const variable = container.querySelector('.variable')!;

    const range = document.createRange();
    range.setStart(keyword.firstChild as Text, 2);
    range.setEnd(variable.firstChild as Text, 3);
    expect(range.toString()).toBe('nst foo');

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('const foobar');
  });

  it('leaves selections outside any token unchanged', () => {
    const container = renderContainer(`<p>plain paragraph text here</p>`);
    const text = container.querySelector('p')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('plain');
  });

  it('returns an identical range when no endpoints are in tokens', () => {
    const container = renderContainer(
      `<pre data-target-kind="code-block"><code class="shiki">plain text with no spans</code></pre>`,
    );
    const code = container.querySelector('code')!;
    const text = code.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('plain');
  });

  it('only widens the endpoint that sits inside a token when the other does not', () => {
    const container = renderContainer(
      `<pre data-target-kind="code-block"><code class="shiki">lead <span class="shiki-token variable">foobar</span> trail</code></pre>`,
    );
    const code = container.querySelector('code')!;
    const variable = container.querySelector('.variable')!;
    const leadText = code.firstChild as Text;
    const variableText = variable.firstChild as Text;

    const range = document.createRange();
    range.setStart(leadText, 2);
    range.setEnd(variableText, 3);
    expect(range.toString()).toBe('ad foo');

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('ad foobar');
  });
});

function renderContainer(html: string): HTMLElement {
  document.body.innerHTML = '';
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}
