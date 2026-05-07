import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import {
  type FakeCommandRunner,
  createStubContext,
  marketplaceListResult,
  pluginListResult,
  readErrorLogs,
  readLogs,
} from '#src/testHelpers/index.ts';
import { ClaudeInstaller } from './ClaudeInstaller.ts';
import { getDescriptor } from './registry.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;
type PluginFixture = Parameters<typeof pluginListResult>[0][number];
type MarketplaceFixture = Parameters<typeof marketplaceListResult>[0][number];

describe('ClaudeInstaller.install', () => {
  it('runs marketplace-add then plugin-install at user scope and emits onboarding prose', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, []);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();

    await installer.install(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
    ]);

    const stderr = io.stderr.text();
    expect(stderr).toContain('PlanBridge plugin installed for Claude Code (scope: user)');
    expect(stderr).toContain('Restart Claude Code');
    expect(stderr).not.toContain('renamed from cli@contextbridge');
    expect(io.stdout.text()).toBe('');
  });

  it('updates the plugin when the new id is already installed at the target scope', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'user' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves({
      stdout: "Adding marketplace…✔ Marketplace 'contextbridge' already on disk — declared in user settings",
    });
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'update']).resolves({
      stdout: 'Updated plugin "planbridge@contextbridge" to latest version',
    });

    await installer.install(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'update', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
    ]);
    expect(io.stderr.text()).toContain('installed for Claude Code');
  });

  it('migrates a legacy cli@contextbridge install at the target scope after installing the new id', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [{ id: 'cli@contextbridge', scope: 'user' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();

    await installer.install(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'cli@contextbridge', '--scope', 'user'], opts: {} },
    ]);

    const stderr = io.stderr.text();
    expect(stderr).toContain(
      'PlanBridge plugin renamed from cli@contextbridge to planbridge@contextbridge — migrated automatically.',
    );
    expect(stderr).toContain('PlanBridge plugin installed for Claude Code (scope: user)');
  });

  it('leaves legacy cli@contextbridge alone when it is at a different scope than the install target', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [{ id: 'cli@contextbridge', scope: 'project' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();

    await installer.install(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
    ]);
    expect(io.stderr.text()).not.toContain('renamed from cli@contextbridge');
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
    stubPluginList(commandRunner, []);
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])
      .resolves({ exitCode: 1, stderr: 'network unreachable' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toHaveLength(2);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('network unreachable'))).toBe(true);
  });

  it('aborts when plugin-install fails after a successful marketplace-add', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, []);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'install'])
      .resolves({ exitCode: 1, stderr: 'plugin not found in marketplace' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toHaveLength(3);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('plugin not found in marketplace'))).toBe(true);
  });

  it('does not remove a legacy install when the new plugin install fails', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [{ id: 'cli@contextbridge', scope: 'user' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'install'])
      .resolves({ exitCode: 1, stderr: 'plugin not found in marketplace' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
    ]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('plugin not found in marketplace'))).toBe(true);
  });

  it('does not remove a legacy install when the new plugin update fails', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [
      { id: 'planbridge@contextbridge', scope: 'user' },
      { id: 'cli@contextbridge', scope: 'user' },
    ]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'update']).resolves({ exitCode: 1, stderr: 'update failed' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'update', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
    ]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('update failed'))).toBe(true);
  });

  it('logs a synthetic detail when stderr is empty on a non-zero exit', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, []);
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
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'user' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
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
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'project' }]);
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'remove', 'contextbridge'], opts: {} },
    ]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
    expect(readLogs(logs).some((r) => r.msg.includes('not installed at scope user'))).toBe(true);
  });

  it('skips marketplace-remove when the marketplace is not configured', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'user' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    stubMarketplaceList(commandRunner, []);

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'list', '--json'], opts: {} },
    ]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
    expect(readLogs(logs).some((r) => r.msg.includes('marketplace is not configured'))).toBe(true);
  });

  it('uninstalls a legacy cli@contextbridge install at the target scope', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [{ id: 'cli@contextbridge', scope: 'user' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'cli@contextbridge', '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'remove', 'contextbridge'], opts: {} },
    ]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
    expect(readLogs(logs).some((r) => r.msg.includes('not installed at scope user'))).toBe(true);
  });

  it('uninstalls both the new id and the legacy cli@contextbridge when both are at the target scope', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [
      { id: 'planbridge@contextbridge', scope: 'user' },
      { id: 'cli@contextbridge', scope: 'user' },
    ]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'planbridge@contextbridge', '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'cli@contextbridge', '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'remove', 'contextbridge'], opts: {} },
    ]);
  });

  it('is fully idempotent when both the plugin and marketplace are already absent', async () => {
    const installer = new ClaudeInstaller();
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, []);
    stubMarketplaceList(commandRunner, []);

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'list', '--json'], opts: {} },
    ]);
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
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'user' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves({ exitCode: 1, stderr: 'disk full' });

    expect(installer.uninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toHaveLength(2);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('disk full'))).toBe(true);
  });

  it('bubbles a real marketplace-remove failure after a clean plugin uninstall', () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, logs } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'user' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])
      .resolves({ exitCode: 1, stderr: 'some other marketplace error' });

    expect(installer.uninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toHaveLength(4);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('some other marketplace error'))).toBe(true);
  });
});

describe('ClaudeInstaller scope prompt', () => {
  it('prompts for scope when yes=false and installs at the chosen scope', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, []);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();
    prompter.setSelect('project');

    await installer.install(context, { yes: false });

    expect(prompter.selectCalls).toHaveLength(1);
    expect(prompter.selectCalls[0]?.message).toBe('Install scope:');
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])[0]?.args).toContain('project');
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])[0]?.args).toContain('project');
  });

  it('skips the scope prompt when yes=true and uses the user-scope default', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubPluginList(commandRunner, []);
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
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'project' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();
    prompter.setSelect('project');

    await installer.uninstall(context, { yes: false });

    expect(prompter.selectCalls).toHaveLength(1);
    expect(prompter.selectCalls[0]?.message).toBe('Uninstall scope:');
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])[0]?.args).toEqual([
      'plugin',
      'uninstall',
      'planbridge@contextbridge',
      '--scope',
      'project',
    ]);
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
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'user' }]);

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.managed).toEqual([
      { kind: 'marketplace', identifier: 'contextbridge' },
      { kind: 'plugin', identifier: 'planbridge@contextbridge', scope: 'user' },
    ]);
  });

  it('reports project-scope plugin installs', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubMarketplaceList(commandRunner, []);
    stubPluginList(commandRunner, [{ id: 'planbridge@contextbridge', scope: 'project' }]);

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.managed).toEqual([{ kind: 'plugin', identifier: 'planbridge@contextbridge', scope: 'project' }]);
  });

  it('reports a legacy cli@contextbridge install as managed but not installed', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    stubPluginList(commandRunner, [{ id: 'cli@contextbridge', scope: 'user' }]);

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([
      { kind: 'marketplace', identifier: 'contextbridge' },
      { kind: 'plugin', identifier: 'cli@contextbridge', scope: 'user' },
    ]);
  });

  it('reports both new and legacy plugin entries when both are installed', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    stubPluginList(commandRunner, [
      { id: 'planbridge@contextbridge', scope: 'user' },
      { id: 'cli@contextbridge', scope: 'user' },
    ]);

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.managed).toEqual([
      { kind: 'marketplace', identifier: 'contextbridge' },
      { kind: 'plugin', identifier: 'planbridge@contextbridge', scope: 'user' },
      { kind: 'plugin', identifier: 'cli@contextbridge', scope: 'user' },
    ]);
  });

  it('reports marketplace-only partial state as managed but not installed', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubMarketplaceList(commandRunner, [{ name: 'contextbridge' }]);
    stubPluginList(commandRunner, []);

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([{ kind: 'marketplace', identifier: 'contextbridge' }]);
  });

  it('reports detected: true with no managed entries when claude is on PATH but PlanBridge is not installed', async () => {
    const installer = new ClaudeInstaller();
    const { context, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    stubMarketplaceList(commandRunner, []);
    stubPluginList(commandRunner, []);

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

function stubPluginList(commandRunner: FakeCommandRunner, plugins: PluginFixture[]): void {
  commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult(plugins));
}

function stubMarketplaceList(commandRunner: FakeCommandRunner, marketplaces: MarketplaceFixture[]): void {
  commandRunner
    .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
    .resolves(marketplaceListResult(marketplaces));
}
