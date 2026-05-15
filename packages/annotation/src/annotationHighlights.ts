import type { ResolvedAnnotation } from './annotationTypes.ts';

const BASE_HIGHLIGHT = 'cb-plan-annotations';
const ACTIVE_HIGHLIGHT = 'cb-plan-annotation-active';
const DRAFT_HIGHLIGHT = 'cb-plan-annotation-draft';
const ALL_HIGHLIGHTS = [BASE_HIGHLIGHT, ACTIVE_HIGHLIGHT, DRAFT_HIGHLIGHT] as const;

export function syncAnnotationHighlights(args: {
  annotations: ResolvedAnnotation[];
  activeAnnotationId: string | null;
  draftRange: Range | null;
}): void {
  clearAnnotationHighlights();
  if (getAnnotationHighlightWarning()) {
    return;
  }

  const registry = CSS.highlights;
  const baseRanges: Range[] = [];
  const activeRanges: Range[] = [];

  for (const item of args.annotations) {
    if (!item.range) {
      continue;
    }
    (item.thread.id === args.activeAnnotationId ? activeRanges : baseRanges).push(item.range);
  }

  if (baseRanges.length > 0) {
    registry.set(BASE_HIGHLIGHT, new Highlight(...baseRanges));
  }
  if (activeRanges.length > 0) {
    registry.set(ACTIVE_HIGHLIGHT, new Highlight(...activeRanges));
  }
  if (args.draftRange) {
    registry.set(DRAFT_HIGHLIGHT, new Highlight(args.draftRange));
  }
}

export function clearAnnotationHighlights(): void {
  if (getAnnotationHighlightWarning()) {
    return;
  }

  for (const name of ALL_HIGHLIGHTS) {
    CSS.highlights.delete(name);
  }
}

// CSS Custom Highlight API — supported in all evergreen browsers since 2024.
// See https://caniuse.com/mdn-api_css_highlights_static for current coverage.
export function getAnnotationHighlightWarning(): string | null {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
    ? null
    : 'This browser does not support the CSS Custom Highlight API. Annotations still save, but inline highlights are unavailable.';
}
