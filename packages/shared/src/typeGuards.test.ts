import { describe, expect, it } from 'bun:test';
import { isRecord } from './typeGuards.ts';

describe('isRecord', () => {
  it('returns true for non-array objects', () => {
    expect(isRecord({})).toBe(true);
  });

  it('returns false for arrays, null, and primitives', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('value')).toBe(false);
  });
});
