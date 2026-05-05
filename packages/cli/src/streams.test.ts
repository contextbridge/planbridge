import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'bun:test';
import { readStreamToString } from './streams.ts';

describe('readStreamToString', () => {
  it('returns the empty string for an immediately-closed stream', async () => {
    const stream = new PassThrough();
    stream.end();
    expect(await readStreamToString(stream)).toBe('');
  });

  it('concatenates utf8 chunks', async () => {
    const stream = new PassThrough();
    stream.write('hello, ');
    stream.write('world');
    stream.end();
    expect(await readStreamToString(stream)).toBe('hello, world');
  });

  it('handles multi-byte utf8 split across chunks', async () => {
    const stream = new PassThrough();
    // "😀" is F0 9F 98 80 — split across two writes to prove buffering works.
    stream.write(Buffer.from([0xf0, 0x9f]));
    stream.write(Buffer.from([0x98, 0x80]));
    stream.end();
    expect(await readStreamToString(stream)).toBe('😀');
  });
});
