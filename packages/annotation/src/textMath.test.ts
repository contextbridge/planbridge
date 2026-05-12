import { describe, expect, it } from 'vitest';
import { buildTargetLabel, createShortHash, findQuoteStart, normalizeText } from './textMath.ts';

describe('findQuoteStart', () => {
  it('returns the match position when the quote is unique', () => {
    const text = 'Start by refactoring the parser before touching the API.';
    expect(findQuoteStart(text, { exact: 'refactoring', prefix: 'Start by ', suffix: ' the parser' })).toBe(9);
  });

  it('uses prefix/suffix to disambiguate repeated text', () => {
    const text = 'the cat sat on the mat and then the cat left';
    const start = findQuoteStart(text, { exact: 'the cat', prefix: 'and then ', suffix: ' left' });
    expect(start).toBe(32);
  });

  it('returns null when prefix/suffix disagree and multiple candidates exist', () => {
    const text = 'alpha beta alpha beta alpha';
    expect(findQuoteStart(text, { exact: 'alpha', prefix: 'xxx', suffix: 'yyy' })).toBeNull();
  });

  it('falls back to a single match even when prefix/suffix would mismatch', () => {
    const text = 'Only one unique phrase lives here.';
    expect(findQuoteStart(text, { exact: 'unique phrase', prefix: 'mismatch', suffix: 'mismatch' })).toBe(9);
  });

  it('returns null when the quote is absent', () => {
    expect(findQuoteStart('hello world', { exact: 'goodbye', prefix: '', suffix: '' })).toBeNull();
  });
});

describe('normalizeText', () => {
  it('collapses internal whitespace to single spaces and trims edges', () => {
    expect(normalizeText('  a\tb\n c   d  ')).toBe('a b c d');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeText('   \n\t  ')).toBe('');
  });
});

describe('buildTargetLabel', () => {
  it('appends a truncated quote when text is present', () => {
    expect(buildTargetLabel('List item', 'Buy groceries')).toBe('List item: "Buy groceries"');
  });

  it('normalizes whitespace inside the quoted text', () => {
    expect(buildTargetLabel('Paragraph', '  a\n\tb ')).toBe('Paragraph: "a b"');
  });

  it('returns just the prefix when the text is empty', () => {
    expect(buildTargetLabel('Table', '   ')).toBe('Table');
  });

  it('truncates long text to 96 characters', () => {
    const long = 'x'.repeat(200);
    const label = buildTargetLabel('Paragraph', long);
    expect(label.length).toBeLessThanOrEqual('Paragraph: ""'.length + 96);
    expect(label.endsWith('…"')).toBe(true);
  });
});

describe('createShortHash', () => {
  it('is deterministic for the same input', () => {
    expect(createShortHash('hello world')).toBe(createShortHash('hello world'));
  });

  it('produces exactly 8 hex characters', () => {
    expect(createShortHash('hello world')).toMatch(/^[0-9a-f]{8}$/);
    expect(createShortHash('')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('differs for different inputs', () => {
    expect(createShortHash('abc')).not.toBe(createShortHash('abd'));
  });
});
