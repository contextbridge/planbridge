import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';
import { adapterForLang } from './ElementAdapter.ts';

export const ELEMENT_SOURCE_PROPERTY = 'dataElementSource';
export const ELEMENT_LANG_PROPERTY = 'dataElementLang';

const LANGUAGE_PREFIX = 'language-';

// Runs before rehype-highlight: for any fenced code block whose language a registered adapter
// claims, stashes the raw source + language onto the <code> node and drops the language class so
// the highlighter leaves it alone. Reading raw text here (pre-highlight) avoids reconstructing it
// from tokenized highlight spans later. Registry-driven, so adding a content type needs no change
// here.
export function rehypeElementSources() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'code') return;

      const classes = toClassList(node.properties?.className);
      const lang = classes.find((cls) => cls.startsWith(LANGUAGE_PREFIX))?.slice(LANGUAGE_PREFIX.length);
      if (!lang || !adapterForLang(lang)) return;

      node.properties = {
        ...node.properties,
        className: stripLanguageClasses(classes),
        [ELEMENT_SOURCE_PROPERTY]: collectText(node),
        [ELEMENT_LANG_PROPERTY]: lang,
      };
    });
  };
}

// Removes the `language-*` class so rehype-highlight leaves the block untouched; the adapter
// renders it instead.
function stripLanguageClasses(classes: string[]): string[] {
  return classes.filter((cls) => !cls.startsWith(LANGUAGE_PREFIX));
}

function toClassList(className: Element['properties'][string] | undefined): string[] {
  if (Array.isArray(className)) return className.map(String);
  if (typeof className === 'string') return className.split(/\s+/).filter(Boolean);
  return [];
}

function collectText(node: Element): string {
  return node.children
    .map((child) => {
      if (child.type === 'text') return child.value;
      if (child.type === 'element') return collectText(child);
      return '';
    })
    .join('');
}
