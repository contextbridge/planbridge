import { describe, expect, it } from 'bun:test';
import { createDeferred } from './testHelpers.ts';

describe('createDeferred', () => {
  it('exposes promise controls to resolve later', () => {
    const deferred = createDeferred<string>();

    deferred.resolve('done');

    expect(deferred.promise).resolves.toBe('done');
  });

  it('exposes promise controls to reject later', () => {
    const deferred = createDeferred<string>();
    const error = new Error('failed');

    deferred.reject(error);

    expect(deferred.promise).rejects.toThrow(error);
  });
});
