import { describe, expect, it } from 'bun:test';
import { getEnvironment } from './environment.ts';

describe('boolean env coercion', () => {
  describe.each([
    'DO_NOT_TRACK' as const,
    'CONTEXTBRIDGE_TELEMETRY_DISABLED' as const,
    'CONTEXTBRIDGE_UPDATE_CHECK_DISABLED' as const,
  ])('%s', (key) => {
    it.each(['1', 'true', 'YES'])('coerces truthy value %s to true', (value) => {
      expect(getEnvironment({ [key]: value })[key]).toBe(true);
    });

    it.each(['', '0', 'false', 'no'])('coerces non-truthy value %j to false', (value) => {
      expect(getEnvironment({ [key]: value })[key]).toBe(false);
    });

    it('defaults to false when unset', () => {
      expect(getEnvironment({})[key]).toBe(false);
    });
  });
});
