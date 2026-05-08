import { describe, expect, it } from 'bun:test';
import { FakeCommandRunner } from './FakeCommandRunner.ts';

describe('FakeCommandRunner', () => {
  describe('which', () => {
    it('returns the resolved path when set', () => {
      const cr = new FakeCommandRunner();
      cr.setWhich('claude', '/usr/local/bin/claude');
      expect(cr.which('claude')).toBe('/usr/local/bin/claude');
    });

    it('returns null when set to null', () => {
      const cr = new FakeCommandRunner();
      cr.setWhich('claude', null);
      expect(cr.which('claude')).toBeNull();
    });
  });

  describe('on(cmd, args) — prefix match', () => {
    it('matches when call args start with the matcher args', async () => {
      const cr = new FakeCommandRunner();
      cr.on('claude', ['plugin', 'install']).resolves({ stdout: 'ok' });

      const result = await cr.run('claude', ['plugin', 'install', 'cli@contextbridge', '--scope', 'user']);

      expect(result.stdout).toBe('ok');
    });

    it('does not match when prefix differs', () => {
      const cr = new FakeCommandRunner();
      cr.on('claude', ['plugin', 'install']).resolves();

      expect(cr.run('claude', ['plugin', 'list'])).rejects.toThrow(/no responder/);
    });

    it('does not match when cmd differs', () => {
      const cr = new FakeCommandRunner();
      cr.on('claude', ['plugin']).resolves();

      expect(cr.run('codex', ['plugin'])).rejects.toThrow(/no responder/);
    });

    it('without args matches any args for cmd', async () => {
      const cr = new FakeCommandRunner();
      cr.on('claude').resolves({ stdout: 'ok' });

      const result = await cr.run('claude', ['anything', 'goes']);

      expect(result.stdout).toBe('ok');
    });
  });

  describe('onAny()', () => {
    it('fires for any call', async () => {
      const cr = new FakeCommandRunner();
      cr.onAny().resolves({ stdout: 'catch' });

      const r1 = await cr.run('claude', ['plugin', 'list']);
      const r2 = await cr.run('codex', ['something', 'else']);

      expect(r1.stdout).toBe('catch');
      expect(r2.stdout).toBe('catch');
    });
  });

  describe('resolves() defaults', () => {
    it('resolves with { exitCode: 0, stdout: "", stderr: "" } when called with no argument', async () => {
      const cr = new FakeCommandRunner();
      cr.onAny().resolves();

      const result = await cr.run('claude', []);

      expect(result).toEqual({ exitCode: 0, stdout: '', stderr: '' });
    });

    it('fills missing fields when given a partial result', async () => {
      const cr = new FakeCommandRunner();
      cr.onAny().resolves({ exitCode: 1, stderr: 'boom' });

      const result = await cr.run('claude', []);

      expect(result).toEqual({ exitCode: 1, stdout: '', stderr: 'boom' });
    });
  });

  describe('matcher order — last match wins', () => {
    it('uses the responder registered last when multiple match, so later overrides win', async () => {
      const cr = new FakeCommandRunner();
      cr.onAny().resolves({ stdout: 'first' });
      cr.onAny().resolves({ stdout: 'second' });

      const result = await cr.run('claude', []);

      expect(result.stdout).toBe('second');
    });

    it('lets a specific override replace a generic default', async () => {
      const cr = new FakeCommandRunner();
      cr.on('claude').resolves({ stdout: 'default' });
      cr.on('claude', ['plugin', 'install']).resolves({ stdout: 'override' });

      const generic = await cr.run('claude', ['plugin', 'list']);
      const overridden = await cr.run('claude', ['plugin', 'install']);

      expect(generic.stdout).toBe('default');
      expect(overridden.stdout).toBe('override');
    });

    it('falls through past responders that do not match', async () => {
      const cr = new FakeCommandRunner();
      cr.on('claude').resolves({ stdout: 'claude-result' });
      cr.on('codex').resolves({ stdout: 'codex-result' });

      const result = await cr.run('codex', []);

      expect(result.stdout).toBe('codex-result');
    });
  });

  describe('rejects()', () => {
    it('rejects with the provided Error', () => {
      const cr = new FakeCommandRunner();
      cr.on('claude').rejects(new Error('boom'));

      expect(cr.run('claude', [])).rejects.toThrow('boom');
    });

    it('wraps non-Error rejection values in an Error', () => {
      const cr = new FakeCommandRunner();
      cr.onAny().rejects('string failure');

      expect(cr.run('claude', [])).rejects.toThrow('string failure');
    });
  });

  describe('miss diagnostic', () => {
    it('describes the failing call, registered matchers, and prior calls', async () => {
      const cr = new FakeCommandRunner();
      cr.on('claude', ['plugin']).resolves();
      cr.on('codex').resolves();

      await cr.run('claude', ['plugin', 'list']);

      const reason = await cr.run('zsh', ['-c', 'pwd']).catch((err: unknown) => (err as Error).message);

      expect(reason).toContain('no responder for `zsh -c pwd`');
      expect(reason).toContain('Registered matchers (2, in order):');
      expect(reason).toContain('1. on("claude", ["plugin"])');
      expect(reason).toContain('2. on("codex")');
      expect(reason).toContain('Prior calls in this run (1):');
      expect(reason).toContain('1. claude plugin list');
    });

    it('shows "(none)" when no matchers are registered', async () => {
      const cr = new FakeCommandRunner();
      const reason = await cr.run('zsh', []).catch((err: unknown) => (err as Error).message);
      expect(reason).toContain('Registered matchers (0, in order):\n  (none)');
      expect(reason).toContain('Prior calls in this run (0):\n  (none)');
    });

    it('records the failing call in calls[]', () => {
      const cr = new FakeCommandRunner();
      expect(cr.run('claude', ['x'])).rejects.toThrow(/no responder/);
      expect(cr.calls).toEqual([{ cmd: 'claude', args: ['x'], opts: {} }]);
    });
  });

  describe('calls bookkeeping', () => {
    it('records every call regardless of whether a responder matched', async () => {
      const cr = new FakeCommandRunner();
      cr.onAny().resolves();

      await cr.run('claude', ['one']);
      await cr.run('codex', ['two', 'three']);

      expect(cr.calls).toEqual([
        { cmd: 'claude', args: ['one'], opts: {} },
        { cmd: 'codex', args: ['two', 'three'], opts: {} },
      ]);
    });

    it('records the opts argument', async () => {
      const cr = new FakeCommandRunner();
      cr.onAny().resolves();

      await cr.run('claude', ['x'], { stdio: 'inherit' });

      expect(cr.calls[0]?.opts).toEqual({ stdio: 'inherit' });
    });
  });

  describe('callsTo', () => {
    it('filters by prefix match', async () => {
      const cr = new FakeCommandRunner();
      cr.onAny().resolves();

      await cr.run('claude', ['plugin', 'install', 'cli@contextbridge']);
      await cr.run('claude', ['plugin', 'list', '--json']);
      await cr.run('codex', ['plugin', 'install']);

      expect(cr.callsTo('claude', ['plugin', 'install'])).toHaveLength(1);
      expect(cr.callsTo('claude', ['plugin', 'install'])[0]?.args).toEqual(['plugin', 'install', 'cli@contextbridge']);
      expect(cr.callsTo('claude')).toHaveLength(2);
    });
  });
});
