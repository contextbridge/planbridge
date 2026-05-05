import { describe, expect, it } from 'bun:test';
import { hasErrorCode } from './errors.ts';

describe('hasErrorCode', () => {
  it('matches object-like errors by code', () => {
    expect(hasErrorCode({ code: 'ENOENT' }, 'ENOENT')).toBe(true);
  });

  it('returns false when the value is not an error with that code', () => {
    expect(hasErrorCode({ code: 'EACCES' }, 'ENOENT')).toBe(false);
    expect(hasErrorCode(null, 'ENOENT')).toBe(false);
  });
});
