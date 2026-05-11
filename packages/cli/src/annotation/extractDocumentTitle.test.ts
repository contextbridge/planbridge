import { describe, expect, it } from 'bun:test';
import { extractDocumentTitle } from './extractDocumentTitle.ts';

describe('extractDocumentTitle', () => {
  it('returns the first H1 text from a simple document', () => {
    expect(extractDocumentTitle('# Title\n\nbody')).toBe('Title');
  });

  it('strips inline emphasis', () => {
    expect(extractDocumentTitle('# **Bold** *italic* title')).toBe('Bold italic title');
  });

  it('strips inline code', () => {
    expect(extractDocumentTitle('# Use `flag` correctly')).toBe('Use flag correctly');
  });

  it('handles setext-style H1', () => {
    expect(extractDocumentTitle('Title\n=====\n\nbody')).toBe('Title');
  });

  it('tolerates leading blank lines', () => {
    expect(extractDocumentTitle('\n\n# Title')).toBe('Title');
  });

  it('returns null when there is no H1', () => {
    expect(extractDocumentTitle('no heading here')).toBeNull();
  });

  it('does not match a # inside a fenced code block', () => {
    const content = '```\n# Not a heading\n```\n\nbody';
    expect(extractDocumentTitle(content)).toBeNull();
  });

  it('does not match H2 or H3', () => {
    expect(extractDocumentTitle('## Subhead\n\n### Sub-subhead')).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(extractDocumentTitle('')).toBeNull();
  });

  it('returns the first H1 when several are present', () => {
    expect(extractDocumentTitle('# First\n\nbody\n\n# Second')).toBe('First');
  });

  it('returns null when the H1 is whitespace-only after stripping', () => {
    expect(extractDocumentTitle('# \n\nbody')).toBeNull();
  });
});
