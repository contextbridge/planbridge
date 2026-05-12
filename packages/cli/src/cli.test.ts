import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';
import { Command } from 'commander';
import { getDescriptor } from '#src/harnesses/registry.ts';
import { environment } from '#src/testFactories.ts';
import { createStubContext, readErrorLogs } from '#src/testHelpers/index.ts';
import { resolveCbCommand, runCli } from './cli.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;
const CODEX_BINARY = getDescriptor('codex').binaryName;

describe('runCli', () => {
  it('prints the version on --version', async () => {
    const { context, io } = createStubContext();
    const exitCode = await runCli(context, ['--version']);
    expect(exitCode).toBe(0);
    expect(io.stdout.text().trim()).toBe('test');
  });

  it.each<{ argv: string[]; contains: string }>([
    { argv: ['--help'], contains: 'plan' },
    { argv: ['plan', '--help'], contains: '[path]' },
  ])('$argv renders help text containing "$contains"', async ({ argv, contains }) => {
    const { context, io } = createStubContext();
    const exitCode = await runCli(context, argv);
    expect(exitCode).toBe(0);
    expect(io.stdout.text()).toContain(contains);
  });

  // Plan-handler behavior lives in plan.test.ts. Here we only verify argv
  // routes into the plan subcommand — an unknown flag on `plan` surfaces as
  // a CommanderError with a non-zero exit.
  it('routes argv into the plan subcommand', async () => {
    const { context, io } = createStubContext();
    const exitCode = await runCli(context, ['plan', '--bogus']);
    expect(exitCode).not.toBe(0);
    expect(io.stderr.text()).toContain('--bogus');
  });

  it.each(['abc', '3000.5', '0', '-1', '65536'])('rejects invalid plan --port value %s', async (port) => {
    const { context, io } = createStubContext();
    const exitCode = await runCli(context, ['plan', '--port', port]);
    expect(exitCode).not.toBe(0);
    expect(io.stderr.text()).toContain('port must be an integer between 1 and 65535');
  });

  it('routes argv into the hook claude subcommand', async () => {
    const { context, io, logs } = createStubContext();
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/work',
        hook_event_name: 'PreToolUse',
      }),
    );
    io.stdin.end();

    const exitCode = await runCli(context, ['hook', 'claude']);

    expect(exitCode).toBe(1);
    expect(io.stdout.text()).toBe('');
    expect(readErrorLogs(logs).some((r) => r.msg.includes('unsupported hook_event_name: PreToolUse'))).toBe(true);
  });

  it('surfaces unknown flags on hook claude as a CommanderError', async () => {
    const { context, io } = createStubContext();
    const exitCode = await runCli(context, ['hook', 'claude', '--bogus']);
    expect(exitCode).not.toBe(0);
    expect(io.stderr.text()).toContain('--bogus');
  });

  it('routes argv into the hook codex subcommand', async () => {
    const { context, io } = createStubContext();
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: null,
        cwd: '/work',
        hook_event_name: 'Stop',
        model: 'gpt-5.3-codex',
        permission_mode: 'plan',
        turn_id: 'turn_123',
        stop_hook_active: false,
        last_assistant_message: 'No plan.',
      }),
    );
    io.stdin.end();

    const exitCode = await runCli(context, ['hook', 'codex']);

    expect(exitCode).toBe(0);
    expect(io.stdout.text().trim()).toBe('{}');
  });

  it('routes argv into the install claude subcommand with default user scope', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script({ exitCode: 0, stdout: '', stderr: '' }, { exitCode: 0, stdout: '', stderr: '' });

    const exitCode = await runCli(context, ['install', 'claude']);

    expect(exitCode).toBe(0);
    expect(commandRunner.calls[0]?.args).toContain('--scope');
    expect(commandRunner.calls[0]?.args).toContain('user');
    expect(io.stderr.text()).toContain('scope: user');
  });

  it('routes argv into the install codex subcommand with default user scope', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-cli-codex-test-'));
    const { context, io, commandRunner } = createStubContext({ env: environment.build({ HOME: tmp }) });
    commandRunner.setWhich(CODEX_BINARY, '/usr/local/bin/codex');

    try {
      const exitCode = await runCli(context, ['install', 'codex']);

      expect(exitCode).toBe(0);
      expect(JSON.parse(readFileSync(join(tmp, '.codex', 'hooks.json'), 'utf8'))).toMatchObject({
        hooks: { Stop: [{ hooks: [{ command: 'contextbridge hook codex' }] }] },
      });
      expect(readFileSync(join(tmp, '.codex', 'config.toml'), 'utf8')).toContain('codex_hooks = true');
      expect(io.stderr.text()).toContain('scope: user');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('prints handler CommanderError messages from the install codex subcommand', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-cli-codex-test-'));
    const configDir = join(tmp, '.codex');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.toml'), '[features\nbroken');
    const { context, io, commandRunner } = createStubContext({ env: environment.build({ HOME: tmp }) });
    commandRunner.setWhich(CODEX_BINARY, '/usr/local/bin/codex');

    try {
      const exitCode = await runCli(context, ['install', 'codex']);

      expect(exitCode).toBe(1);
      expect(io.stderr.text()).toContain('invalid Codex config.toml');
      expect(existsSync(join(configDir, 'hooks.json'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rejects --scope bogus at the commander layer before any shellout', async () => {
    const { context, commandRunner } = createStubContext();
    const exitCode = await runCli(context, ['install', 'claude', '--scope', 'bogus']);
    expect(exitCode).not.toBe(0);
    expect(commandRunner.calls).toEqual([]);
  });

  it('routes argv into the uninstall claude subcommand with --scope project', async () => {
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      { exitCode: 0, stdout: JSON.stringify([{ id: 'cli@contextbridge', scope: 'project' }]), stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: JSON.stringify([{ name: 'contextbridge' }]), stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
    );

    const exitCode = await runCli(context, ['uninstall', 'claude', '--scope', 'project']);

    expect(exitCode).toBe(0);
    expect(commandRunner.calls[1]?.args).toEqual(['plugin', 'uninstall', 'cli@contextbridge', '--scope', 'project']);
  });

  it('routes argv into the no-target install orchestrator with --yes', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      { exitCode: 0, stdout: '[]', stderr: '' },
      { exitCode: 0, stdout: '[]', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
    );

    const exitCode = await runCli(context, ['install', '--yes']);

    expect(exitCode).toBe(0);
    expect(prompter.calls).toEqual([]);
    expect(io.stderr.text()).toContain('Installed 1 of 1 detected harness');
  });

  it('routes argv into install status with --json and emits to stdout', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      { exitCode: 0, stdout: JSON.stringify([{ name: 'contextbridge' }]), stderr: '' },
      { exitCode: 0, stdout: JSON.stringify([{ id: 'cli@contextbridge', scope: 'user' }]), stderr: '' },
    );

    const exitCode = await runCli(context, ['install', 'status', '--json']);

    expect(exitCode).toBe(0);
    expect(io.stdout.text().trim().startsWith('[')).toBe(true);
  });

  it('registers cb_command and identifies before parsing for a top-level subcommand', async () => {
    const { context, analytics, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      { exitCode: 0, stdout: JSON.stringify([{ name: 'contextbridge' }]), stderr: '' },
      { exitCode: 0, stdout: JSON.stringify([{ id: 'cli@contextbridge', scope: 'user' }]), stderr: '' },
    );

    const exitCode = await runCli(context, ['install', 'status', '--json']);

    expect(exitCode).toBe(0);
    expect(analytics.superProperties['cb_command']).toBe('install status');
    expect(analytics.identifies).toHaveLength(1);
    expect(analytics.identifies[0]).toEqual({
      distinctId: context.distinctId,
      properties: { cb_command: 'install status' },
    });
  });

  it('registers cb_command for a nested subcommand path', async () => {
    const { context, analytics, io } = createStubContext();
    io.stdin.write(
      JSON.stringify({
        session_id: 'sess_123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/work',
        hook_event_name: 'PreToolUse',
      }),
    );
    io.stdin.end();

    await runCli(context, ['hook', 'claude']);

    expect(analytics.superProperties['cb_command']).toBe('hook claude');
    expect(analytics.identifies[0]?.properties).toEqual({ cb_command: 'hook claude' });
  });

  it('registers an empty cb_command when no subcommand matches (e.g. --version)', async () => {
    const { context, analytics } = createStubContext();
    await runCli(context, ['--version']);
    expect(analytics.superProperties['cb_command']).toBe('');
    expect(analytics.identifies[0]?.properties).toEqual({ cb_command: '' });
  });

  it('still registers cb_command when the subcommand fails on a bogus flag', async () => {
    const { context, analytics } = createStubContext();
    const exitCode = await runCli(context, ['plan', '--bogus']);
    expect(exitCode).not.toBe(0);
    expect(analytics.superProperties['cb_command']).toBe('plan');
    expect(analytics.identifies[0]?.properties).toEqual({ cb_command: 'plan' });
  });
});

describe('resolveCbCommand', () => {
  // Lock in that an option's value-token is not misread as a subcommand,
  // even when the value happens to match a real subcommand name.
  it('skips the value of a <value>-style option', () => {
    const program = new Command();
    const parent = program.command('parent').option('-s, --scope <scope>', 'scope');
    parent.command('child');
    expect(resolveCbCommand(program, ['parent', '--scope', 'child', 'child'])).toBe('parent child');
  });

  it('does not treat --flag=value as consuming the next token', () => {
    const program = new Command();
    const parent = program.command('parent').option('-s, --scope <scope>', 'scope');
    parent.command('child');
    expect(resolveCbCommand(program, ['parent', '--scope=anything', 'child'])).toBe('parent child');
  });

  it('stops walking at -- (end-of-options sentinel)', () => {
    const program = new Command();
    program.command('parent').command('child');
    expect(resolveCbCommand(program, ['parent', '--', 'child'])).toBe('parent');
  });
});
