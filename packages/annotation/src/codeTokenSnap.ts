const CODE_BLOCK_SELECTOR = '[data-target-kind="code-block"]';
const TOKEN_SELECTOR = '.shiki-token';

export function snapRangeToTokenBoundaries(range: Range, container: HTMLElement): Range {
  const startToken = findTokenSpan(range.startContainer, container);
  const endToken = findTokenSpan(range.endContainer, container);

  if (!startToken && !endToken) {
    return range;
  }

  const snapped = range.cloneRange();
  if (startToken) {
    snapped.setStartBefore(startToken);
  }
  if (endToken) {
    snapped.setEndAfter(endToken);
  }
  return snapped;
}

export function findTokenSpan(node: Node, container: HTMLElement): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element || !container.contains(element)) {
    return null;
  }

  const token = element.closest(TOKEN_SELECTOR);
  if (!token || !container.contains(token) || !token.closest(CODE_BLOCK_SELECTOR)) {
    return null;
  }
  return token;
}
