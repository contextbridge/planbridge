import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'bun:test';
import { IoImpl } from './IoImpl.ts';
import { FakeIo } from '#src/testHelpers/FakeIo.ts';
import { MemoryStream } from '#src/testHelpers/MemoryStream.ts';

describe('IoImpl', () => {
  it('with quiet=true suppresses convenience writes while preserving raw streams and stdin reads', async () => {
    const stdin = new PassThrough();
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const io = new IoImpl({ stdin, stdout, stderr, quiet: true });
    stdin.end('input');
    io.writeStdout('hidden stdout');
    io.writeStderr('hidden stderr');

    expect(io.stdout).toBe(stdout);
    expect(io.stderr).toBe(stderr);
    expect(await io.readStdin()).toBe('input');
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toBe('');
  });

  it('from() reuses the source streams and applies option overrides', () => {
    const source = new FakeIo();

    const io = IoImpl.from(source, { quiet: true });
    io.writeStdout('hidden stdout');
    io.writeStderr('hidden stderr');

    expect(io.stdout).toBe(source.stdout);
    expect(io.stderr).toBe(source.stderr);
    expect(source.stdout.text()).toBe('');
    expect(source.stderr.text()).toBe('');
  });
});
