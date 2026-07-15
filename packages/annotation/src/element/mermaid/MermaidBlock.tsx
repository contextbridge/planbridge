import { useEffect, useId, useRef, useState } from 'react';
import type { ElementBlockProps } from '#src/element/elementBlock.ts';
import { dispatchElementRendered, elementBlockContainerProps } from '#src/element/elementBlock.ts';
import './mermaidAdapter.css';
import { currentMermaidTheme, renderMermaid } from './renderer.ts';

const NODE_ID_PATTERN = /flowchart-(.+)-\d+$/;

export const mermaidBlockTestIds = {
  container: 'mermaid-block',
  diagram: 'mermaid-block-diagram',
  loading: 'mermaid-block-loading',
};

/**
 * Mermaid's private sub-element tagging vocabulary. `MermaidBlock` writes these after render;
 * `mermaidAdapter` reads them to build/resolve/mark anchors. Kept here (not in the shared
 * `elementBlock` contract) because they are this adapter's business alone.
 */
export const mermaidAttrs = {
  nodeId: 'data-mermaid-node-id',
  edgeId: 'data-mermaid-edge-id',
  label: 'data-mermaid-label',
} as const;

type RenderState = { status: 'loading' } | { status: 'ready'; svg: string } | { status: 'error' };

export function MermaidBlock({ source, contentType, startLine, endLine, fallback }: ElementBlockProps) {
  const reactId = useId();
  const renderId = `mermaid-${reactId}`;
  const diagramRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RenderState>({ status: 'loading' });

  useEffect(() => {
    renderMermaid(renderId, source, currentMermaidTheme())
      .then(({ svg }) => {
        setState({ status: 'ready', svg });
      })
      .catch(() => {
        // Mermaid appends an orphaned error node to <body> on parse failure — clean it up.
        document.getElementById(`d${renderId}`)?.remove();
        setState({ status: 'error' });
      });
  }, [renderId, source]);

  useEffect(() => {
    const host = diagramRef.current;
    if (state.status !== 'ready' || !host || startLine === undefined) return;
    tagMermaidElements(host);
    // Signal that the diagram is in the DOM so markers re-apply for any comments anchored here.
    dispatchElementRendered(host);
  }, [state, startLine]);

  if (state.status === 'error') {
    return <>{fallback}</>;
  }

  if (state.status === 'loading') {
    return (
      <div
        className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground"
        data-testid={mermaidBlockTestIds.loading}
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-md border border-border px-4 py-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      {...elementBlockContainerProps({ contentType, startLine, endLine })}
      data-testid={mermaidBlockTestIds.container}
    >
      <div ref={diagramRef} data-testid={mermaidBlockTestIds.diagram} dangerouslySetInnerHTML={{ __html: state.svg }} />
    </div>
  );
}

function tagMermaidElements(host: HTMLElement): void {
  for (const node of host.querySelectorAll<SVGGElement>('g.node[id]')) {
    const nodeId = NODE_ID_PATTERN.exec(node.id)?.[1];
    if (nodeId === undefined) continue;
    node.setAttribute(mermaidAttrs.nodeId, nodeId);
    node.setAttribute(mermaidAttrs.label, labelOf(node, nodeId));
  }

  for (const edge of host.querySelectorAll<SVGGElement>('g.edgeLabels g.edgeLabel')) {
    const edgeId = edge.querySelector('[data-id]')?.getAttribute('data-id');
    if (!edgeId) continue;
    edge.setAttribute(mermaidAttrs.edgeId, edgeId);
    edge.setAttribute(mermaidAttrs.label, labelOf(edge, edgeId));
  }
}

function labelOf(element: Element, fallback: string): string {
  const text = element.querySelector('.nodeLabel, .edgeLabel, p, text')?.textContent?.trim();
  return text && text.length > 0 ? text : fallback;
}
