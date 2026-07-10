import type { Element, ElementContent, Root, RootContent } from 'hast';
import { toString as hastToString } from 'hast-util-to-string';
import type { HighlighterCore, ShikiTransformer } from 'shiki/types';

export interface RehypeShikiOptions {
  readonly highlighter: HighlighterCore;
  readonly theme: string;
  readonly skipLanguages?: readonly string[];
}

export function rehypeShiki({ highlighter, theme, skipLanguages = [] }: RehypeShikiOptions) {
  return (tree: Root) => {
    visitElements(tree, (node) => {
      if (node.tagName !== 'pre') return;
      const code = node.children.find(isCodeElement);
      const language = code ? languageOf(code) : undefined;
      if (
        !code ||
        !language ||
        skipLanguages.includes(language) ||
        !highlighter.getLoadedLanguages().includes(language)
      ) {
        return;
      }

      const source = hastToString(code).replace(/\n$/, '');
      const highlighted = highlighter.codeToHast(source, {
        lang: language,
        theme,
        transformers: [tokenClassTransformer],
      });
      const highlightedPre = highlighted.children.find(isPreElement);
      const highlightedCode = highlightedPre?.children.find(isCodeElement);
      if (!highlightedCode) return;

      splitTokenWhitespace(highlightedCode);
      code.children = highlightedCode.children;
      code.properties = {
        ...code.properties,
        ...highlightedCode.properties,
        className: [...classesOf(code), 'shiki'],
      };
    });
  };
}

const tokenClassTransformer: ShikiTransformer = {
  name: 'contextbridge-token-class',
  span(node: Element) {
    this.addClassToHast(node, 'shiki-token');
  },
};

function splitTokenWhitespace(element: Element): void {
  const children: ElementContent[] = [];
  for (const child of element.children) {
    if (child.type !== 'element') {
      children.push(child);
      continue;
    }

    if (classesOf(child).includes('shiki-token') && child.children.length === 1 && child.children[0]?.type === 'text') {
      const value = child.children[0].value;
      if (value.trim().length === 0) {
        children.push({ type: 'text', value });
        continue;
      }
      const leading = value.match(/^\s*/)?.[0] ?? '';
      const trailing = value.match(/\s*$/)?.[0] ?? '';
      const token = value.slice(leading.length, value.length - trailing.length);
      if (leading) children.push({ type: 'text', value: leading });
      if (token) children.push({ ...child, children: [{ type: 'text', value: token }] });
      if (trailing) children.push({ type: 'text', value: trailing });
      continue;
    }

    splitTokenWhitespace(child);
    children.push(child);
  }
  element.children = children;
}

function visitElements(node: Root | Element, visitor: (element: Element) => void): void {
  for (const child of node.children) {
    if (child.type !== 'element') continue;
    visitor(child);
    visitElements(child, visitor);
  }
}

function isCodeElement(node: RootContent): node is Element {
  return node.type === 'element' && node.tagName === 'code';
}

function isPreElement(node: RootContent): node is Element {
  return node.type === 'element' && node.tagName === 'pre';
}

function languageOf(code: Element): string | undefined {
  const languageClass = classesOf(code).find((className) => className.startsWith('language-'));
  return languageClass?.slice('language-'.length);
}

function classesOf(element: Element): string[] {
  const className = element.properties.className ?? element.properties['class'];
  return Array.isArray(className) ? className.map(String) : [];
}
