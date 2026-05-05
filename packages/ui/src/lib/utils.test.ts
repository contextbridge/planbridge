import { describe, expect, it } from 'bun:test';
import { cn } from './utils.ts';

describe('cn', () => {
  it('merges conditional classes and tailwind conflicts', () => {
    const conditionalClass: string | undefined = undefined;

    expect(cn('px-2', conditionalClass, 'px-4', 'text-sm')).toBe('px-4 text-sm');
  });
});
