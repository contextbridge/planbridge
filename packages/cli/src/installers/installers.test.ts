import { INSTALLABLE_HARNESSES } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { ALL_INSTALLERS } from './installers.ts';

describe('ALL_INSTALLERS', () => {
  it('every installer descriptor is an installable harness descriptor (no orphans)', () => {
    for (const installer of ALL_INSTALLERS) {
      const match = INSTALLABLE_HARNESSES.find((d) => d.id === installer.descriptor.id);
      expect(match).toBe(installer.descriptor);
    }
  });

  it('contains no duplicate harness ids', () => {
    const ids = ALL_INSTALLERS.map((i) => i.descriptor.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
