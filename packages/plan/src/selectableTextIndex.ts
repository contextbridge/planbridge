import type { StoredAnnotationAnchor } from '@contextbridge/shared/planReviewSchema';
import type { AnnotatableTarget, SelectableTextIndex } from './annotationTypes.ts';
import { buildTargetLabel, createShortHash, findQuoteStart, normalizeText } from './textMath.ts';

const TEXT_CONTEXT_RADIUS = 48;

export function buildSelectableTextIndex(container: HTMLElement): SelectableTextIndex {
  const targets = prepareAnnotatableTargets(container);
  const fullText = getTextFromRoot(container);

  return {
    container,
    fullText,
    targets,
    rangeToAnchor: (range, createdFrom, explicitTarget) =>
      rangeToAnchor({ container, fullText, targets, range, createdFrom, explicitTarget }),
    targetToRange: (targetId) => {
      const target = targets.get(targetId);
      return target ? getRangeForElementText(target.element) : null;
    },
    restoreAnchor: (anchor) => restoreAnchor({ container, fullText, targets, anchor }),
    resolveTarget: (targetId) => targets.get(targetId) ?? null,
  };
}

function rangeToAnchor(args: {
  container: HTMLElement;
  fullText: string;
  targets: Map<string, AnnotatableTarget>;
  range: Range;
  createdFrom: StoredAnnotationAnchor['createdFrom'];
  explicitTarget?: HTMLElement;
}): StoredAnnotationAnchor {
  const { container, fullText, targets, range, createdFrom, explicitTarget } = args;
  const selectionText = range.toString();
  if (selectionText.length === 0) {
    throw new Error('cannot anchor an empty range');
  }

  const startTarget = explicitTarget ?? getClosestTargetElement(container, range.startContainer);
  const endTarget = explicitTarget ?? getClosestTargetElement(container, range.endContainer);
  if (!startTarget || !endTarget) {
    throw new Error('selection must resolve to annotatable targets');
  }

  const startTargetId = startTarget.dataset.targetId;
  const endTargetId = endTarget.dataset.targetId;
  if (!startTargetId || !endTargetId) {
    throw new Error('annotatable targets must have data-target-id set by the text index');
  }

  const start = measureTextOffset(container, range.startContainer, range.startOffset);
  const end = measureTextOffset(container, range.endContainer, range.endOffset);
  const targetRecord = resolveAnchorTarget({ targets, container, range, startTarget, endTarget, explicitTarget });

  const sourceLines = resolveSourceLineRange(range.startContainer, range.endContainer);

  return {
    createdFrom,
    sourceLines,
    quote: {
      exact: selectionText,
      prefix: fullText.slice(Math.max(0, start - TEXT_CONTEXT_RADIUS), start),
      suffix: fullText.slice(end, end + TEXT_CONTEXT_RADIUS),
    },
    position: {
      start,
      end,
    },
    endpoints: {
      start: {
        targetId: startTargetId,
        offset: measureTextOffset(startTarget, range.startContainer, range.startOffset),
      },
      end: {
        targetId: endTargetId,
        offset: measureTextOffset(endTarget, range.endContainer, range.endOffset),
      },
    },
    target: targetRecord
      ? {
          id: targetRecord.id,
          kind: targetRecord.kind,
          label: targetRecord.label,
        }
      : undefined,
    snapshot: {
      targetText: targetRecord?.text || selectionText,
      blockText: targetRecord?.kind === 'inline' ? findNearestBlockText(targets, targetRecord.element) : undefined,
    },
  };
}

function restoreAnchor(args: {
  container: HTMLElement;
  fullText: string;
  targets: Map<string, AnnotatableTarget>;
  anchor: StoredAnnotationAnchor;
}): Range | null {
  const { container, fullText, targets, anchor } = args;

  const endpointRange = restoreByEndpoints(targets, anchor);
  if (endpointRange) {
    return endpointRange;
  }

  const positionRange = createRangeFromOffsets(container, anchor.position.start, anchor.position.end);
  if (positionRange) {
    return positionRange;
  }

  const quoteRange = createRangeFromQuote(container, fullText, anchor.quote);
  if (quoteRange) {
    return quoteRange;
  }

  if (anchor.target) {
    const target = targets.get(anchor.target.id);
    if (target) {
      return createRangeFromQuote(target.element, target.text, anchor.quote);
    }
  }

  return null;
}

function restoreByEndpoints(targets: Map<string, AnnotatableTarget>, anchor: StoredAnnotationAnchor): Range | null {
  const startTarget = targets.get(anchor.endpoints.start.targetId);
  const endTarget = targets.get(anchor.endpoints.end.targetId);
  if (!startTarget || !endTarget) {
    return null;
  }

  const startPoint = resolveOffsetWithinRoot(startTarget.element, anchor.endpoints.start.offset, 'start');
  const endPoint = resolveOffsetWithinRoot(endTarget.element, anchor.endpoints.end.offset, 'end');
  if (!startPoint || !endPoint) {
    return null;
  }

  return createRangeFromPoints(startPoint, endPoint);
}

function resolveSourceLineRange(startNode: Node, endNode: Node): StoredAnnotationAnchor['sourceLines'] {
  const startElement = nearestElementWithSourceLine(startNode, 'start');
  const endElement = nearestElementWithSourceLine(endNode, 'end');
  if (!startElement || !endElement) {
    throw new Error('selection must resolve to elements with source-line data attributes');
  }

  const start = Number(startElement.dataset.srcStartLine);
  const end = Number(endElement.dataset.srcEndLine);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) {
    throw new Error('source-line data attributes are missing or not positive integers');
  }

  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function nearestElementWithSourceLine(node: Node, boundary: 'start' | 'end'): HTMLElement | null {
  const attr = boundary === 'start' ? 'srcStartLine' : 'srcEndLine';
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.dataset[attr] !== undefined) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function createRangeFromQuote(root: HTMLElement, text: string, quote: StoredAnnotationAnchor['quote']): Range | null {
  const matchStart = findQuoteStart(text, quote);
  if (matchStart === null) {
    return null;
  }

  return createRangeFromOffsets(root, matchStart, matchStart + quote.exact.length);
}

function createRangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  if (end <= start) {
    return null;
  }

  const startPoint = resolveOffsetWithinRoot(root, start, 'start');
  const endPoint = resolveOffsetWithinRoot(root, end, 'end');
  if (!startPoint || !endPoint) {
    return null;
  }

  return createRangeFromPoints(startPoint, endPoint);
}

function createRangeFromPoints(
  startPoint: { node: Text; offset: number },
  endPoint: { node: Text; offset: number },
): Range | null {
  const range = document.createRange();

  try {
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
  } catch {
    return null;
  }

  return range.collapsed ? null : range;
}

function resolveOffsetWithinRoot(
  root: HTMLElement,
  offset: number,
  mode: 'start' | 'end',
): { node: Text; offset: number } | null {
  const textNodes = getTextNodes(root);
  if (textNodes.length === 0) {
    return null;
  }

  if (offset <= 0) {
    return { node: textNodes[0]!, offset: 0 };
  }

  for (let index = 0; index < textNodes.length; index += 1) {
    const node = textNodes[index]!;
    const nodeStart = measureTextOffset(root, node, 0);
    const nodeEnd = measureTextOffset(root, node, node.data.length);
    if (mode === 'start' && offset === nodeEnd && index < textNodes.length - 1) {
      continue;
    }
    if (offset > nodeEnd && index < textNodes.length - 1) {
      continue;
    }

    const visibleOffset = Math.max(0, Math.min(offset - nodeStart, nodeEnd - nodeStart));
    return {
      node,
      offset: findTextNodeOffset(node, visibleOffset, mode),
    };
  }

  const lastNode = textNodes[textNodes.length - 1]!;
  return {
    node: lastNode,
    offset: lastNode.data.length,
  };
}

function findTextNodeOffset(node: Text, visibleLength: number, mode: 'start' | 'end'): number {
  if (visibleLength <= 0) {
    return 0;
  }

  let lastVisibleOffset = 0;
  for (let offset = 0; offset <= node.data.length; offset += 1) {
    const measured = measureTextOffset(node, node, offset);
    if (mode === 'start' && measured >= visibleLength) {
      return offset;
    }
    if (mode === 'end') {
      if (measured <= visibleLength) {
        lastVisibleOffset = offset;
      }
      if (measured > visibleLength) {
        return lastVisibleOffset;
      }
    }
  }

  return mode === 'end' ? lastVisibleOffset : node.data.length;
}

function measureTextOffset(root: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

const LABEL_PREFIX_BY_KEY: Record<string, string> = {
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  h4: 'Heading',
  h5: 'Heading',
  h6: 'Heading',
  p: 'Paragraph',
  li: 'List item',
  blockquote: 'Blockquote',
  code: 'Code block',
  tr: 'Table row',
  th: 'Table cell',
  td: 'Table cell',
  strong: 'Bold text',
  em: 'Emphasis',
  a: 'Link',
  table: 'Table',
};

function prepareAnnotatableTargets(container: HTMLElement): Map<string, AnnotatableTarget> {
  const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-target-kind]'));
  const siblingCounters = new WeakMap<Element, Map<string, number>>();
  const targets = new Map<string, AnnotatableTarget>();

  for (const element of elements) {
    const key = element.dataset.targetKey ?? element.tagName.toLowerCase();
    const kind = element.dataset.targetKind as AnnotatableTarget['kind'];
    const labelPrefix = LABEL_PREFIX_BY_KEY[key] ?? 'Selection';
    const parent = element.parentElement ?? container;
    const parentCounters = siblingCounters.get(parent) ?? new Map<string, number>();
    const ordinal = parentCounters.get(key) ?? 0;
    parentCounters.set(key, ordinal + 1);
    siblingCounters.set(parent, parentCounters);

    const text = getTextFromRoot(element);
    const id = `${key}:${ordinal}:${createShortHash(normalizeText(text))}`;
    const label = buildTargetLabel(labelPrefix, text);

    element.dataset.targetId = id;

    targets.set(id, {
      id,
      key,
      kind,
      label,
      text,
      element,
    });
  }

  return targets;
}

function resolveAnchorTarget(args: {
  targets: Map<string, AnnotatableTarget>;
  container: HTMLElement;
  range: Range;
  startTarget: HTMLElement;
  endTarget: HTMLElement;
  explicitTarget?: HTMLElement;
}): AnnotatableTarget | null {
  const { targets, container, range, startTarget, endTarget, explicitTarget } = args;

  const explicitId = explicitTarget?.dataset.targetId;
  if (explicitId) {
    return targets.get(explicitId) ?? null;
  }

  const startId = startTarget.dataset.targetId;
  if (startId && startId === endTarget.dataset.targetId) {
    return targets.get(startId) ?? null;
  }

  const commonTarget = getClosestTargetElement(container, range.commonAncestorContainer);
  const commonId = commonTarget?.dataset.targetId;
  return commonId ? (targets.get(commonId) ?? null) : null;
}

function findNearestBlockText(targets: Map<string, AnnotatableTarget>, element: HTMLElement): string | undefined {
  let current = element.parentElement;

  while (current) {
    const targetId = current.dataset.targetId;
    if (targetId) {
      const target = targets.get(targetId);
      if (target && target.kind !== 'inline') {
        return target.text;
      }
    }
    current = current.parentElement;
  }

  return undefined;
}

function getClosestTargetElement(container: HTMLElement, node: Node): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node.parentElement;
  if (!element) {
    return null;
  }

  const target = element.closest<HTMLElement>('[data-target-id]');
  if (!target || !container.contains(target)) {
    return null;
  }

  return target;
}

function getRangeForElementText(element: HTMLElement): Range | null {
  const textNodes = getTextNodes(element);
  if (textNodes.length === 0) {
    return null;
  }

  const range = document.createRange();
  const firstNode = textNodes[0]!;
  const lastNode = textNodes[textNodes.length - 1]!;
  range.setStart(firstNode, 0);
  range.setEnd(lastNode, lastNode.data.length);
  return range;
}

function getTextFromRoot(root: HTMLElement): string {
  const range = getRangeForElementText(root);
  return range ? range.toString() : '';
}

function getTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => ((node.textContent ?? '').length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  return nodes;
}
