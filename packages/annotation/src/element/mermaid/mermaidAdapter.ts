import type { ElementAnnotationAnchor } from '@contextbridge/shared/annotationSchema';
import type { ResolvedAnnotationThread } from '#src/annotationTypes.ts';
import type { ElementAdapter } from '#src/element/ElementAdapter.ts';
import { elementBlockAttrs } from '#src/element/elementBlock.ts';
import { MermaidBlock, mermaidAttrs } from './MermaidBlock.tsx';

const CONTENT_TYPE = 'mermaid';
const MARK_CLASS = 'cb-mermaid-annotated';
const ACTIVE_CLASS = 'cb-mermaid-annotated-active';

/**
 * The Mermaid {@link ElementAdapter}: renders flowchart source to SVG ({@link MermaidBlock}) and
 * anchors annotations to its nodes, edges, or the whole diagram. Hover preview is pure CSS
 * (`g.node:hover` etc. in mermaidAdapter.css).
 */
export const mermaidAdapter: ElementAdapter = {
  contentType: CONTENT_TYPE,
  claims: (lang) => lang === CONTENT_TYPE,
  Block: MermaidBlock,
  buildAnchor,
  resolveTarget,
  applyMarkers,
};

function buildAnchor(block: HTMLElement, clicked: Element): ElementAnnotationAnchor | null {
  const blockTargetId = block.getAttribute(elementBlockAttrs.blockId);
  const start = Number(block.getAttribute('data-src-start-line'));
  const end = Number(block.getAttribute('data-src-end-line'));
  if (!blockTargetId || !Number.isFinite(start) || !Number.isFinite(end) || start < 1) {
    return null;
  }
  const sourceLines = { start, end };

  const node = clicked.closest<HTMLElement>(`[${mermaidAttrs.nodeId}]`);
  if (node && block.contains(node)) {
    const id = node.getAttribute(mermaidAttrs.nodeId) ?? '';
    if (id.length > 0) {
      return elementAnchor(blockTargetId, sourceLines, { id, label: readLabel(node, id), descriptor: 'diagram node' });
    }
  }

  const edge = clicked.closest<HTMLElement>(`[${mermaidAttrs.edgeId}]`);
  if (edge && block.contains(edge)) {
    const id = edge.getAttribute(mermaidAttrs.edgeId) ?? '';
    if (id.length > 0) {
      return elementAnchor(blockTargetId, sourceLines, { id, label: readLabel(edge, id), descriptor: 'diagram edge' });
    }
  }

  return elementAnchor(blockTargetId, sourceLines, { label: 'diagram', descriptor: 'diagram' });
}

function resolveTarget(container: HTMLElement, anchor: ElementAnnotationAnchor): Element | null {
  const block = container.querySelector(`[${elementBlockAttrs.blockId}="${anchor.blockTargetId}"]`);
  if (!block) return null;

  const { id } = anchor.element;
  if (id === undefined) return block;

  return (
    block.querySelector(`[${mermaidAttrs.nodeId}="${id}"]`) ?? block.querySelector(`[${mermaidAttrs.edgeId}="${id}"]`)
  );
}

function applyMarkers(args: {
  container: HTMLElement;
  threads: ResolvedAnnotationThread[];
  activeAnnotationId: string | null;
}): void {
  const { container, threads, activeAnnotationId } = args;
  clearMarkers(container);

  for (const thread of threads) {
    if (thread.anchor.kind !== 'element' || thread.anchor.contentType !== CONTENT_TYPE) continue;
    const element = resolveTarget(container, thread.anchor);
    if (!element) continue;
    element.classList.add(MARK_CLASS);
    if (thread.id === activeAnnotationId) {
      element.classList.add(ACTIVE_CLASS);
    }
  }
}

function elementAnchor(
  blockTargetId: string,
  sourceLines: { start: number; end: number },
  element: ElementAnnotationAnchor['element'],
): ElementAnnotationAnchor {
  return { kind: 'element', contentType: CONTENT_TYPE, blockTargetId, sourceLines, element };
}

function readLabel(element: Element, fallback: string): string {
  const label = element.getAttribute(mermaidAttrs.label)?.trim();
  return label && label.length > 0 ? label : fallback;
}

function clearMarkers(container: HTMLElement): void {
  for (const element of container.querySelectorAll(`.${MARK_CLASS}`)) {
    element.classList.remove(MARK_CLASS, ACTIVE_CLASS);
  }
}
