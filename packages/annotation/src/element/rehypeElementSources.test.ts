import type { Element, Root } from 'hast';
import { describe, expect, it } from 'vitest';
import { ELEMENT_LANG_PROPERTY, ELEMENT_SOURCE_PROPERTY, rehypeElementSources } from './rehypeElementSources.ts';

describe('rehypeElementSources', () => {
  it('stashes source + lang and strips the language class for a claimed language', () => {
    const code = codeNode('language-mermaid', 'flowchart TD\n  A --> B');
    rehypeElementSources()(rootOf(code));

    expect(code.properties[ELEMENT_SOURCE_PROPERTY]).toBe('flowchart TD\n  A --> B');
    expect(code.properties[ELEMENT_LANG_PROPERTY]).toBe('mermaid');
    expect(code.properties.className).toEqual([]);
  });

  it('leaves an unclaimed language untouched', () => {
    const code = codeNode('language-ts', 'const x = 1;');
    rehypeElementSources()(rootOf(code));

    expect(code.properties[ELEMENT_SOURCE_PROPERTY]).toBeUndefined();
    expect(code.properties[ELEMENT_LANG_PROPERTY]).toBeUndefined();
    expect(code.properties.className).toEqual(['language-ts']);
  });

  it('ignores a fenced block with no language class', () => {
    const code = codeNode(undefined, 'plain text');
    rehypeElementSources()(rootOf(code));

    expect(code.properties[ELEMENT_SOURCE_PROPERTY]).toBeUndefined();
  });
});

function codeNode(className: string | undefined, source: string): Element {
  return {
    type: 'element',
    tagName: 'code',
    properties: className ? { className: [className] } : {},
    children: [{ type: 'text', value: source }],
  };
}

function rootOf(code: Element): Root {
  return {
    type: 'root',
    children: [{ type: 'element', tagName: 'pre', properties: {}, children: [code] }],
  };
}
