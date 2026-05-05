import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'bun:test';
import { CommandRunnerImpl } from './CommandRunnerImpl.ts';

describe('CommandRunnerImpl', () => {
  it('runs echo and captures stdout + exit code', async () => {
    const runner = new CommandRunnerImpl();
    const result = await runner.run('echo', ['hello']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('');
  });

  it('captures stderr and non-zero exit for a failing command', async () => {
    const runner = new CommandRunnerImpl();
    const result = await runner.run('sh', ['-c', 'echo oops 1>&2; exit 2']);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('oops\n');
  });

  it('which resolves a known-present binary', () => {
    const runner = new CommandRunnerImpl();
    expect(runner.which('sh')).toMatch(/\/sh$/);
  });

  it('which returns null for an unknown binary', () => {
    const runner = new CommandRunnerImpl();
    expect(runner.which('definitely-not-a-real-binary-xyzzy')).toBeNull();
  });

  it('with stdio: "inherit", tees child output to the injected sinks AND captures it', async () => {
    const out = collect();
    const err = collect();
    const runner = new CommandRunnerImpl({ out: out.stream, err: err.stream });
    const result = await runner.run('sh', ['-c', 'echo to-stdout; echo to-stderr 1>&2; exit 7'], { stdio: 'inherit' });

    expect(result.exitCode).toBe(7);
    expect(result.stdout).toBe('to-stdout\n');
    expect(result.stderr).toBe('to-stderr\n');
    expect(out.text()).toBe('to-stdout\n');
    expect(err.text()).toBe('to-stderr\n');
  });

  it('with stdio: "pipe", does not write to the injected sinks', async () => {
    const out = collect();
    const err = collect();
    const runner = new CommandRunnerImpl({ out: out.stream, err: err.stream });
    await runner.run('sh', ['-c', 'echo piped; echo piped-err 1>&2']);

    expect(out.text()).toBe('');
    expect(err.text()).toBe('');
  });
});

function collect(): { stream: PassThrough; text: () => string } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  return {
    stream,
    text: () => Buffer.concat(chunks).toString('utf8'),
  };
}
