import type { StoredAnnotationAnchor } from '@contextbridge/shared/planReviewSchema';
import { truncate } from './utils.ts';

export function findQuoteStart(text: string, quote: StoredAnnotationAnchor['quote']): number | null {
  const matches: number[] = [];
  let searchFrom = 0;

  while (searchFrom <= text.length) {
    const index = text.indexOf(quote.exact, searchFrom);
    if (index === -1) {
      break;
    }
    matches.push(index);
    searchFrom = index + 1;
  }

  for (const index of matches) {
    const prefix = text.slice(Math.max(0, index - quote.prefix.length), index);
    const suffix = text.slice(index + quote.exact.length, index + quote.exact.length + quote.suffix.length);
    if (prefix === quote.prefix && suffix === quote.suffix) {
      return index;
    }
  }

  return matches.length === 1 ? matches[0]! : null;
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function buildTargetLabel(prefix: string, text: string): string {
  const normalized = normalizeText(text);
  return normalized.length > 0 ? `${prefix}: "${truncate(normalized, 96)}"` : prefix;
}

// FNV-1a 32-bit hash — we need a small, deterministic, collision-resilient id
// for DOM target labels, not cryptographic strength.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function createShortHash(text: string): string {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}
