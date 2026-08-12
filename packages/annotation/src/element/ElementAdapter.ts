import type { ElementAnnotationAnchor } from '@contextbridge/shared/annotationSchema';
import type { ComponentType } from 'react';
import type { ResolvedAnnotationThread } from '#src/annotationTypes.ts';
import type { ElementBlockProps } from './elementBlock.ts';
import { mermaidAdapter } from '#src/element/mermaid/mermaidAdapter.ts';

/**
 * Adapts a non-text content type (e.g. a Mermaid diagram) into the annotation engine. Implement
 * this interface and register the instance in {@link elementAdapters} to make a kind of rendered
 * content annotatable; the resolver, interaction hook, CLI serializer, and sidebar are generic
 * over `element` anchors and need no per-type changes.
 *
 * An adapter is self-contained: it renders its own DOM, tags its own sub-elements (private
 * data-attributes), builds and resolves anchors against those tags, and owns its marker and hover
 * CSS. The only shared surface is the block-level contract in `elementBlock.ts`, which lets the
 * interaction hook route events to the owning adapter.
 */
export interface ElementAdapter {
  /** Stable id for this content type, stored verbatim on every anchor as `contentType` and used to route resolve/marker/hover calls back here. e.g. `'mermaid'`. */
  readonly contentType: string;

  /** The fenced-code info-string languages this adapter renders, e.g. `['mermaid']`. Also excluded from Shiki so claimed blocks keep their raw text. */
  readonly languages: string[];

  /** React component that renders the source to DOM and tags its annotatable sub-elements. Spreads the shared block-level attrs from `elementBlock.ts` and dispatches `ELEMENT_RENDERED_EVENT` once tagged so markers re-apply. */
  readonly Block: ComponentType<ElementBlockProps>;

  /** Translate a click on a tagged sub-element (or the block itself) into a stored anchor; return null if the click isn't on something annotatable. Stamps the agent-facing `descriptor` + `label` here — this is where serialization wording is decided. */
  buildAnchor(block: HTMLElement, clicked: Element): ElementAnnotationAnchor | null;

  /** Find the live DOM element a stored anchor points at (for focus/scroll/marker placement). Returns null when the content changed and the element is gone. */
  resolveTarget(container: HTMLElement, anchor: ElementAnnotationAnchor): Element | null;

  /** Paint saved/active markers for this adapter's threads. Receives the element threads (the hook filters to this `contentType`); clears its own markers before re-applying. */
  applyMarkers(args: {
    container: HTMLElement;
    threads: ResolvedAnnotationThread[];
    activeAnnotationId: string | null;
  }): void;
}

/** The registered element adapters. Add a new content type here — nothing else changes. */
export const elementAdapters: ElementAdapter[] = [mermaidAdapter];

/** Every language a registered element adapter renders; excluded from Shiki so those blocks are left as raw text. */
export const elementAdapterLanguages = elementAdapters.flatMap((adapter) => adapter.languages);

/** The element adapter that renders a given fenced-code language, if any. */
export function elementAdapterForLanguage(language: string): ElementAdapter | undefined {
  return elementAdapters.find((adapter) => adapter.languages.includes(language));
}

/** The element adapter that owns a given `contentType` (an anchor's `contentType`), if any. */
export function elementAdapterForContentType(contentType: string): ElementAdapter | undefined {
  return elementAdapters.find((adapter) => adapter.contentType === contentType);
}
