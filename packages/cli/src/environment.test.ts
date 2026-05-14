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

describe('CONTEXTBRIDGE_PORT', () => {
  it('coerces a configured port to a number', () => {
    expect(getEnvironment({ CONTEXTBRIDGE_PORT: '3000' }).CONTEXTBRIDGE_PORT).toBe(3000);
  });

  it('is unset by default', () => {
    expect(getEnvironment({}).CONTEXTBRIDGE_PORT).toBeUndefined();
  });

  it.each(['abc', '3000.5', '0', '-1', '65536'])('rejects invalid value %s', (value) => {
    expect(() => getEnvironment({ CONTEXTBRIDGE_PORT: value })).toThrow();
  });
});
