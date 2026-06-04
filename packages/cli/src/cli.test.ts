import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getHarness } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { Command } from 'commander';
import { CLAUDE_MARKETPLACE_NAME, CLAUDE_PLUGIN_ID } from '#src/installers/ClaudeInstaller.ts';
import { environment } from '#src/testFactories.ts';
import { createStubContext, primeClaudeShellouts, readErrorLogs, stubClaudeState } from '#src/testHelpers/index.ts';
import { resolveCbCommand, runCli } from './cli.ts';

const CLAUDE_BINARY = getHarness('claude').binaryName;
const CODEX_BINARY = getHarness('codex').binaryName;

describe('runCli', () => {
  it('prints the version on --version', async () => {
    const { context, io } = createStubContext();
    const exitCode = await runCli(context, ['--version']);
    expect(exitCode).toBe(0);
    expect(io.stdout.text().trim()).toBe('test');
  });

  it.each<{ argv: string[]; contains: string }>([
    { argv: ['--help'], contains: 'plan' },
    { argv: ['--help'], contains: 'inbox' },
    { argv: ['--help'], contains: 'open' },
    { argv: ['plan', '--help'], contains: '[path]' },
    { argv: ['open', '--help'], contains: '[path]' },
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

  // Open-handler behavior lives in open.test.ts. Here we only verify argv
  // routes into the open subcommand — an unknown flag on `open` surfaces as
  // a CommanderError with a non-zero exit.
  it('routes argv into the open subcommand', async () => {
    const { context, io } = createStubContext();
    const exitCode = await runCli(context, ['open', '--bogus']);
    expect(exitCode).not.toBe(0);
    expect(io.stderr.text()).toContain('--bogus');
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
    const { context, io, commandRunner } = setupClaudeTest();

    const exitCode = await runCli(context, ['install', 'claude']);

    expect(exitCode).toBe(0);
    const marketplaceAdd = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']);
    expect(marketplaceAdd[0]?.args).toContain('--scope');
    expect(marketplaceAdd[0]?.args).toContain('user');
    expect(io.stderr.text()).toContain('scope: user');
  });

  it('routes argv into the install codex subcommand with default user scope', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-cli-codex-test-'));
    const { context, io, commandRunner } = createStubContext({ env: environment.build({ HOME: tmp }) });
    commandRunner.setWhich(CODEX_BINARY, '/usr/local/bin/codex');
    commandRunner.on(CODEX_BINARY, ['--version']).resolves({ stdout: 'codex-cli 0.129.0\n' });
    commandRunner.on(CODEX_BINARY, ['features', 'enable', 'hooks']).resolves();

    try {
      const exitCode = await runCli(context, ['install', 'codex']);

      expect(exitCode).toBe(0);
      expect(JSON.parse(readFileSync(join(tmp, '.codex', 'hooks.json'), 'utf8'))).toMatchObject({
        hooks: { Stop: [{ hooks: [{ command: 'contextbridge hook codex' }] }] },
      });
      expect(commandRunner.callsTo(CODEX_BINARY, ['features', 'enable', 'hooks'])).toHaveLength(1);
      expect(io.stderr.text()).toContain('scope: user');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('routes install codex without parsing Codex config.toml', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-cli-codex-test-'));
    const configDir = join(tmp, '.codex');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.toml'), '[features\nbroken');
    const { context, io, commandRunner } = createStubContext({ env: environment.build({ HOME: tmp }) });
    commandRunner.setWhich(CODEX_BINARY, '/usr/local/bin/codex');
    commandRunner.on(CODEX_BINARY, ['--version']).resolves({ stdout: 'codex-cli 0.129.0\n' });
    commandRunner.on(CODEX_BINARY, ['features', 'enable', 'hooks']).resolves();

    try {
      const exitCode = await runCli(context, ['install', 'codex']);

      expect(exitCode).toBe(0);
      expect(io.stderr.text()).toContain('PlanBridge hook installed for Codex CLI');
      expect(existsSync(join(configDir, 'hooks.json'))).toBe(true);
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
    const { context, commandRunner } = setupClaudeTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'project' }] }],
    });

    const exitCode = await runCli(context, ['uninstall', 'claude', '--scope', 'project']);

    expect(exitCode).toBe(0);
    const uninstallCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall']);
    expect(uninstallCalls).toHaveLength(1);
    expect(uninstallCalls[0]?.args).toEqual(['plugin', 'uninstall', CLAUDE_PLUGIN_ID, '--scope', 'project']);
  });

  it('routes argv into the no-target install orchestrator with --yes', async () => {
    const { context, io, prompter } = setupClaudeTest();

    const exitCode = await runCli(context, ['install', '--yes']);

    expect(exitCode).toBe(0);
    expect(prompter.calls).toEqual([]);
    expect(io.stderr.text()).toContain('Installed 1 of 1 detected harness');
  });

  it('routes argv into install status with --json and emits to stdout', async () => {
    const { context, io, commandRunner } = setupClaudeTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'user' }] }],
    });

    const exitCode = await runCli(context, ['install', 'status', '--json']);

    expect(exitCode).toBe(0);
    expect(io.stdout.text().trim().startsWith('[')).toBe(true);
  });

  it('registers cb_command and identifies before parsing for a top-level subcommand', async () => {
    const { context, analytics, commandRunner } = setupClaudeTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'user' }] }],
    });

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

function setupClaudeTest(overrides?: Parameters<typeof createStubContext>[0]) {
  const stub = createStubContext(overrides);
  primeClaudeShellouts(stub.commandRunner);
  return stub;
}
