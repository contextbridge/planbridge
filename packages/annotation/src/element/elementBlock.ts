import type { ReactNode } from 'react';

/**
 * The minimal contract shared between the generic element-annotation layer and every
 * {@link ElementAdapter}. An adapter renders its own DOM and tags its own sub-elements with
 * private attributes; the only thing it shares is this block-level vocabulary, which lets the
 * interaction hook (`useElementTargets`) find a rendered block and route events to the adapter
 * that owns it. There is deliberately no shared wrapper component — just these attrs, the id
 * scheme, and the ready event.
 */

/** Props every adapter's `Block` component receives from `AnnotatedMarkdown`. */
export interface ElementBlockProps {
  /** The block's raw source text (for Mermaid, the diagram definition). */
  source: string;
  /** The owning adapter's content type, e.g. `'mermaid'`. */
  contentType: string;
  /** Document-absolute first line of the block's source. Absent ⇒ no position info, so annotation is disabled but the block still renders. */
  startLine?: number;
  /** Document-absolute last line of the block's source. */
  endLine?: number;
  /** Rendered verbatim when the source fails to parse — keeps malformed content visible as a plain code block. */
  fallback: ReactNode;
}

/** Block-level data attributes. Sub-element tagging is each adapter's private business. */
export const elementBlockAttrs = {
  /** Marks a rendered, annotatable block. */
  block: 'data-element-block',
  /** Stable block id; the interaction hook keys off this to find blocks. */
  blockId: 'data-element-block-id',
  /** The owning adapter's content type; the hook reads it to pick the adapter. */
  contentType: 'data-element-content-type',
} as const;

/** Custom event an adapter's `Block` dispatches once it has rendered and tagged its elements, so the hook re-applies markers for any existing annotations. */
export const ELEMENT_RENDERED_EVENT = 'cb:element-rendered';

/**
 * Stable id for a rendered block: `${contentType}:${startLine}`. Keyed on the block's first
 * source line so it survives a reload of the same content. Returns undefined when the block has
 * no position info (annotation disabled).
 */
export function elementBlockId(contentType: string, startLine?: number): string | undefined {
  return startLine === undefined ? undefined : `${contentType}:${startLine}`;
}

/**
 * The block-level attributes an adapter spreads onto its container element. Returns an empty
 * object (no annotatable attrs) when there's no position info, so the block renders but can't
 * be annotated. Source-line attrs reuse the same `data-src-*` names as text targets.
 */
export function elementBlockContainerProps(args: {
  contentType: string;
  startLine?: number;
  endLine?: number;
}): Record<string, string> {
  const { contentType, startLine, endLine } = args;
  const blockId = elementBlockId(contentType, startLine);
  if (blockId === undefined || startLine === undefined) {
    return {};
  }

  const props: Record<string, string> = {
    [elementBlockAttrs.block]: '',
    [elementBlockAttrs.blockId]: blockId,
    [elementBlockAttrs.contentType]: contentType,
    'data-src-start-line': String(startLine),
  };
  if (endLine !== undefined) {
    props['data-src-end-line'] = String(endLine);
  }
  return props;
}

/** Tell the annotation layer a block finished rendering and tagging, so markers re-apply. */
export function dispatchElementRendered(host: HTMLElement): void {
  host.dispatchEvent(new CustomEvent(ELEMENT_RENDERED_EVENT, { bubbles: true }));
}
