import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';

export function extractPlanTitle(content: string): string | null {
  const tree = fromMarkdown(content);
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 1) {
      const text = toString(node).trim();
      return text.length > 0 ? text : null;
    }
  }
  return null;
}
