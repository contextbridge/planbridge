import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import {
  createStubContext,
  marketplaceListResult,
  pluginListResult,
  readErrorLogs,
  readLogs,
} from '#src/testHelpers/index.ts';
import { ClaudeInstaller } from './ClaudeInstaller.ts';
import { getDescriptor } from './registry.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;

describe('ClaudeInstaller.install', () => {
  it('runs marketplace-add then plugin-install at user scope and emits onboarding prose', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();

    await installer.install(context, { yes: true });

    // Ordering is load-bearing: marketplace-add must precede plugin-install.
    expect(commandRunner.calls).toEqual([
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', 'cli@contextbridge', '--scope', 'user'], opts: {} },
    ]);

    const stderr = io.stderr.text();
    expect(stderr).toContain('PlanBridge plugin installed for Claude Code (scope: user)');
    expect(stderr).toContain('Restart Claude Code');
    expect(io.stdout.text()).toBe('');
  });

  it('succeeds on re-install because the claude CLI is naturally idempotent', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves({
      stdout: "Adding marketplace…✔ Marketplace 'contextbridge' already on disk — declared in user settings",
    });
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves({
      stdout: 'Installing plugin "cli@contextbridge"...✔ Plugin "cli@contextbridge" is already installed (scope: user)',
    });

    await installer.install(context, { yes: true });

    expect(io.stderr.text()).toContain('installed for Claude Code');
  });

  it('aborts when claude is not on PATH and never invokes a shellout', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    expect(installer.install(context, { yes: true })).rejects.toThrow('Install Claude Code');
    expect(commandRunner.calls).toEqual([]);
  });

  it('aborts when marketplace-add fails and bubbles stderr', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])
      .resolves({ exitCode: 1, stderr: 'network unreachable' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toEqual([]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('network unreachable'))).toBe(true);
  });

  it('aborts when plugin-install fails after a successful marketplace-add', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'install'])
      .resolves({ exitCode: 1, stderr: 'plugin not found in marketplace' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toHaveLength(1);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('plugin not found in marketplace'))).toBe(true);
  });

  it('logs a synthetic detail when stderr is empty on a non-zero exit', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves({ exitCode: 3 });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(readLogs(logs).some((r) => r.msg.includes('exited 3'))).toBe(true);
  });
});

describe('ClaudeInstaller.uninstall', () => {
  it('lists, uninstalls, lists marketplaces, removes marketplace, emits confirmation at user scope', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: 'contextbridge' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();

    await installer.uninstall(context, { yes: true });

    // Ordering is load-bearing: list → uninstall → list-marketplaces → remove-marketplace.
    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'cli@contextbridge', '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'remove', 'contextbridge'], opts: {} },
    ]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed from Claude Code (scope: user)');
    expect(io.stdout.text()).toBe('');
  });

  it('skips plugin-uninstall when the plugin is not installed at the user scope', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: 'cli@contextbridge', scope: 'project' }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: 'contextbridge' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toHaveLength(1);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
    expect(readLogs(logs).some((r) => r.msg.includes('not installed at scope user'))).toBe(true);
  });

  it('skips marketplace-remove when the marketplace is not configured', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toEqual([]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
    expect(readLogs(logs).some((r) => r.msg.includes('marketplace is not configured'))).toBe(true);
  });

  it('is fully idempotent when both the plugin and marketplace are already absent', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toEqual([]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
  });

  it('aborts when claude is not on PATH and never invokes a shellout', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    expect(installer.uninstall(context, { yes: true })).rejects.toThrow('Install Claude Code');
    expect(commandRunner.calls).toEqual([]);
  });

  it('bubbles a CommanderError and runs no further shellouts when `plugin list --json` fails', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves({ exitCode: 1, stderr: 'permission denied' });

    expect(installer.uninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toHaveLength(1);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('permission denied'))).toBe(true);
  });

  it('bubbles a real plugin-uninstall failure and does not call marketplace-list', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves({ exitCode: 1, stderr: 'disk full' });

    expect(installer.uninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'list', '--json'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])).toEqual([]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('disk full'))).toBe(true);
  });

  it('bubbles a real marketplace-remove failure after a clean plugin uninstall', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: 'contextbridge' }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])
      .resolves({ exitCode: 1, stderr: 'some other marketplace error' });

    expect(installer.uninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toHaveLength(1);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('some other marketplace error'))).toBe(true);
  });
});

describe('ClaudeInstaller scope prompt', () => {
  it('prompts for scope when yes=false and installs at the chosen scope', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();
    prompter.setSelect('project');

    await installer.install(context, { yes: false });

    expect(prompter.selectCalls).toHaveLength(1);
    expect(prompter.selectCalls[0]?.message).toBe('Install scope:');
    const marketplaceAdd = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']);
    const pluginInstall = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install']);
    expect(marketplaceAdd[0]?.args).toContain('project');
    expect(pluginInstall[0]?.args).toContain('project');
  });

  it('skips the scope prompt when yes=true and uses the user-scope default', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();

    await installer.install(context, { yes: true });

    expect(prompter.selectCalls).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])[0]?.args).toContain('user');
  });

  it('prompts for scope on uninstall when yes=false', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: 'cli@contextbridge', scope: 'project' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: 'contextbridge' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();
    prompter.setSelect('project');

    await installer.uninstall(context, { yes: false });

    expect(prompter.selectCalls).toHaveLength(1);
    expect(prompter.selectCalls[0]?.message).toBe('Uninstall scope:');
    const uninstallCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall']);
    expect(uninstallCalls[0]?.args).toEqual(['plugin', 'uninstall', 'cli@contextbridge', '--scope', 'project']);
  });
});

describe('ClaudeInstaller.status', () => {
  it('reports detected: false with no managed entries when claude is not on PATH', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    const status = await installer.status(context);

    expect(status.detected).toBe(false);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([]);
    expect(commandRunner.calls).toEqual([]);
  });

  it('reports detected: true with marketplace and user-scope plugin entries when present', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: 'contextbridge' }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]));

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.managed).toEqual([
      { kind: 'marketplace', identifier: 'contextbridge' },
      { kind: 'plugin', identifier: 'cli@contextbridge', scope: 'user' },
    ]);
  });

  it('reports project-scope plugin installs', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: 'cli@contextbridge', scope: 'project' }]));

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.managed).toEqual([{ kind: 'plugin', identifier: 'cli@contextbridge', scope: 'project' }]);
  });

  it('reports marketplace-only partial state as managed but not installed', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: 'contextbridge' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([{ kind: 'marketplace', identifier: 'contextbridge' }]);
  });

  it('reports detected: true with no managed entries when claude is on PATH but PlanBridge is not installed', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([]);
  });

  it('bubbles a CommanderError when marketplace status cannot be listed', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves({ exitCode: 2 });

    expect(installer.status(context)).rejects.toBeInstanceOf(CommanderError);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('exited 2'))).toBe(true);
  });
});
