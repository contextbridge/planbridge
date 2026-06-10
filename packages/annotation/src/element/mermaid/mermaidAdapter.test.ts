import { afterEach, describe, expect, it } from 'vitest';
import type { ResolvedAnnotationThread } from '../../annotationTypes.ts';
import { mermaidAdapter } from './mermaidAdapter.ts';

describe('mermaidAdapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('buildAnchor', () => {
    it('builds a node anchor from a clicked node', () => {
      const { block } = renderBlock();
      const node = block.querySelector('[data-mermaid-node-id]')!;

      expect(mermaidAdapter.buildAnchor(block, node)).toEqual({
        kind: 'element',
        contentType: 'mermaid',
        blockTargetId: 'mermaid:5',
        sourceLines: { start: 5, end: 9 },
        element: { id: 'login', label: 'Login', descriptor: 'diagram node' },
      });
    });

    it('builds an edge anchor from a clicked edge label', () => {
      const { block } = renderBlock();
      const edge = block.querySelector('[data-mermaid-edge-id]')!;

      expect(mermaidAdapter.buildAnchor(block, edge)?.element).toEqual({
        id: 'e1',
        label: 'submits',
        descriptor: 'diagram edge',
      });
    });

    it('falls back to a whole-block anchor (no element id) when the click is not on a tagged element', () => {
      const { block } = renderBlock();

      expect(mermaidAdapter.buildAnchor(block, block)?.element).toEqual({ label: 'diagram', descriptor: 'diagram' });
    });
  });

  describe('resolveTarget', () => {
    it('round-trips a node anchor back to its element', () => {
      const { container, block } = renderBlock();
      const node = block.querySelector('[data-mermaid-node-id]')!;
      const anchor = mermaidAdapter.buildAnchor(block, node)!;

      expect(mermaidAdapter.resolveTarget(container, anchor)).toBe(node);
    });

    it('resolves a whole-block anchor to the block element', () => {
      const { container, block } = renderBlock();
      const anchor = mermaidAdapter.buildAnchor(block, block)!;

      expect(mermaidAdapter.resolveTarget(container, anchor)).toBe(block);
    });

    it('returns null when the element id no longer exists', () => {
      const { container, block } = renderBlock();
      const anchor = mermaidAdapter.buildAnchor(block, block.querySelector('[data-mermaid-node-id]')!)!;
      block.querySelector('[data-mermaid-node-id]')!.removeAttribute('data-mermaid-node-id');

      expect(mermaidAdapter.resolveTarget(container, anchor)).toBeNull();
    });
  });

  it('marks a thread element with the active class when it is the active annotation', () => {
    const { container, block } = renderBlock();
    const node = block.querySelector('[data-mermaid-node-id]')!;
    const anchor = mermaidAdapter.buildAnchor(block, node)!;
    const thread: ResolvedAnnotationThread = {
      id: 'thr_1',
      anchor,
      range: null,
      target: null,
      unresolved: false,
      quote: 'Login',
      comments: [],
    };

    mermaidAdapter.applyMarkers({ container, threads: [thread], activeAnnotationId: 'thr_1' });

    expect(node.classList.contains('cb-mermaid-annotated')).toBe(true);
    expect(node.classList.contains('cb-mermaid-annotated-active')).toBe(true);
  });
});

function renderBlock(): { container: HTMLElement; block: HTMLElement } {
  const container = document.createElement('div');
  container.innerHTML = `
    <div data-element-block data-element-block-id="mermaid:5" data-element-content-type="mermaid"
         data-src-start-line="5" data-src-end-line="9">
      <svg>
        <g class="node" data-mermaid-node-id="login" data-mermaid-label="Login"><rect></rect></g>
        <g class="edgeLabel" data-mermaid-edge-id="e1" data-mermaid-label="submits"><rect></rect></g>
      </svg>
    </div>`;
  document.body.appendChild(container);
  const block = container.querySelector<HTMLElement>('[data-element-block-id]')!;
  return { container, block };
}
