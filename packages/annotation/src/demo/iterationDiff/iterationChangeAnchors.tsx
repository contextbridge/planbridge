import type { IterationChange } from './iterationChanges.tsx';

export function findIterationChangeElement(content: HTMLElement, change: IterationChange): HTMLElement | null {
  if (change.sourceLine === undefined) {
    return null;
  }
  const candidates = content.querySelectorAll<HTMLElement>(`[data-src-start-line="${change.sourceLine}"]`);
  if (candidates.length === 0) {
    return null;
  }
  if (change.targetKind) {
    for (const candidate of candidates) {
      if (candidate.dataset.targetKind === change.targetKind) {
        return candidate;
      }
    }
  }
  return candidates[0] ?? null;
}

export function isInlineChange(change: IterationChange): boolean {
  return change.kind !== 'removed' && change.sourceLine !== undefined;
}
