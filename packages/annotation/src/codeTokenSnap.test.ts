import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderAnnotatedMarkdown, textRange } from '#src/testHelpers/index.tsx';
import { findTokenSpan, snapRangeToTokenBoundaries } from './codeTokenSnap.ts';

afterEach(() => {
  cleanup();
});

describe('findTokenSpan', () => {
  it('returns the Shiki token containing a node inside a code-block', () => {
    const container = renderAnnotatedMarkdown(typescriptBlock('const foo = 1;'));
    const fooToken = tokenSpan(container, 'foo');

    expect(findTokenSpan(fooToken.firstChild!, container)).toBe(fooToken);
  });

  it('returns null outside any code-block', () => {
    const container = renderAnnotatedMarkdown('plain paragraph *emphasized* text');
    const em = container.querySelector('em')!;

    expect(findTokenSpan(em.firstChild!, container)).toBeNull();
  });

  it('returns null for whitespace between tokens', () => {
    const container = renderAnnotatedMarkdown(typescriptBlock('const foo'));
    const whitespace = tokenSpan(container, 'const').nextSibling!;

    expect(whitespace.textContent).toBe(' ');
    expect(findTokenSpan(whitespace.firstChild!, container)).toBeNull();
  });

  it('returns null for inline code', () => {
    const container = renderAnnotatedMarkdown('Call `const` here.');
    const code = container.querySelector('code')!;

    expect(findTokenSpan(code.firstChild!, container)).toBeNull();
  });
});

describe('snapRangeToTokenBoundaries', () => {
  it('widens a selection starting and ending inside the same token', () => {
    const container = renderAnnotatedMarkdown(typescriptBlock('const foobar'));
    const range = textRange({ node: tokenTextNode(container, 'foobar'), from: 1, to: 3 });
    expect(range.toString()).toBe('oo');

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('foobar');
  });

  it('widens both endpoints when a selection spans multiple tokens', () => {
    const container = renderAnnotatedMarkdown(typescriptBlock('const foobar = 42;'));
    const range = document.createRange();
    range.setStart(tokenTextNode(container, 'const'), 2);
    range.setEnd(tokenTextNode(container, 'foobar'), 3);
    expect(range.toString()).toBe('nst foo');

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('const foobar');
  });

  it('leaves selections outside any token unchanged', () => {
    const container = renderAnnotatedMarkdown('plain paragraph text here');
    const range = textRange({ node: container.querySelector('p')!.firstChild as Text, from: 0, to: 5 });

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('plain');
  });

  it('returns an identical range for a code-block without a highlighted language', () => {
    const container = renderAnnotatedMarkdown('```\nplain text with no spans\n```');
    const range = textRange({ node: container.querySelector('code')!.firstChild as Text, from: 0, to: 5 });

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe('plain');
  });

  it('only widens the endpoint that sits inside a token when the other does not', () => {
    const container = renderAnnotatedMarkdown(typescriptBlock('const foobar'));
    const whitespace = tokenSpan(container, 'const').nextSibling!.firstChild as Text;
    const range = document.createRange();
    range.setStart(whitespace, 0);
    range.setEnd(tokenTextNode(container, 'foobar'), 3);
    expect(range.toString()).toBe(' foo');

    const snapped = snapRangeToTokenBoundaries(range, container);
    expect(snapped.toString()).toBe(' foobar');
  });
});

function typescriptBlock(source: string): string {
  return `\`\`\`typescript\n${source}\n\`\`\``;
}

function tokenSpan(container: HTMLElement, text: string): HTMLElement {
  const token = [...container.querySelectorAll<HTMLElement>('.shiki-token')].find(
    (candidate) => candidate.textContent === text,
  );
  if (!token) {
    throw new Error(`Expected a Shiki token with text ${JSON.stringify(text)}.`);
  }
  return token;
}

function tokenTextNode(container: HTMLElement, text: string): Text {
  return tokenSpan(container, text).firstChild as Text;
}
