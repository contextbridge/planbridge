import { describe, expect, it } from 'bun:test';
import { extractPlanTitle } from './extractPlanTitle.ts';

describe('extractPlanTitle', () => {
  it('returns the first H1 text from a simple plan', () => {
    expect(extractPlanTitle('# Title\n\nbody')).toBe('Title');
  });

  it('strips inline emphasis', () => {
    expect(extractPlanTitle('# **Bold** *italic* title')).toBe('Bold italic title');
  });

  it('strips inline code', () => {
    expect(extractPlanTitle('# Use `flag` correctly')).toBe('Use flag correctly');
  });

  it('handles setext-style H1', () => {
    expect(extractPlanTitle('Title\n=====\n\nbody')).toBe('Title');
  });

  it('tolerates leading blank lines', () => {
    expect(extractPlanTitle('\n\n# Title')).toBe('Title');
  });

  it('returns null when there is no H1', () => {
    expect(extractPlanTitle('no heading here')).toBeNull();
  });

  it('does not match a # inside a fenced code block', () => {
    const content = '```\n# Not a heading\n```\n\nbody';
    expect(extractPlanTitle(content)).toBeNull();
  });

  it('does not match H2 or H3', () => {
    expect(extractPlanTitle('## Subhead\n\n### Sub-subhead')).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(extractPlanTitle('')).toBeNull();
  });

  it('returns the first H1 when several are present', () => {
    expect(extractPlanTitle('# First\n\nbody\n\n# Second')).toBe('First');
  });

  it('returns null when the H1 is whitespace-only after stripping', () => {
    expect(extractPlanTitle('# \n\nbody')).toBeNull();
  });
});
