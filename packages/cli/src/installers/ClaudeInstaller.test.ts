import { getHarness } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import {
  createStubContext,
  primeClaudeShellouts,
  readErrorLogs,
  readLogs,
  stubClaudeState,
} from '#src/testHelpers/index.ts';
import {
  CLAUDE_LEGACY_PLUGIN_ID,
  CLAUDE_MARKETPLACE_NAME,
  CLAUDE_MARKETPLACE_SOURCE,
  CLAUDE_PLUGIN_ID,
  ClaudeInstaller,
} from './ClaudeInstaller.ts';

const CLAUDE_BINARY = getHarness('claude').binaryName;

describe('ClaudeInstaller.install', () => {
  it('runs marketplace-add then plugin-install at user scope and emits onboarding prose', async () => {
    const { installer, context, io, commandRunner } = setupTest();

    await installer.install(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', CLAUDE_MARKETPLACE_SOURCE, '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'update', CLAUDE_MARKETPLACE_NAME], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', CLAUDE_PLUGIN_ID, '--scope', 'user'], opts: {} },
    ]);

    const stderr = io.stderr.text();
    expect(stderr).toContain('PlanBridge plugin installed for Claude Code (scope: user)');
    expect(stderr).toContain('Restart Claude Code');
    expect(stderr).not.toContain('renamed from cli@contextbridge');
    expect(io.stdout.text()).toBe('');
  });

  it('updates the plugin when the new id is already installed at the target scope', async () => {
    const { installer, context, io, commandRunner } = setupTest();
    stubClaudeState(commandRunner, { unmanagedPlugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'user' }] });
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves({
      stdout: "Adding marketplace…✔ Marketplace 'contextbridge' already on disk — declared in user settings",
    });

    await installer.install(context, { yes: true });

    const updateCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'update']);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.args).toEqual(['plugin', 'update', CLAUDE_PLUGIN_ID, '--scope', 'user']);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'update'])).toHaveLength(1);
    expect(io.stderr.text()).toContain('installed for Claude Code');
  });

  it('migrates a legacy cli@contextbridge install at the target scope after installing the new id', async () => {
    const { installer, context, io, commandRunner } = setupTest();
    stubClaudeState(commandRunner, { unmanagedPlugins: [{ id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' }] });

    await installer.install(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', CLAUDE_MARKETPLACE_SOURCE, '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'update', CLAUDE_MARKETPLACE_NAME], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', CLAUDE_PLUGIN_ID, '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', CLAUDE_LEGACY_PLUGIN_ID, '--scope', 'user'], opts: {} },
    ]);

    const stderr = io.stderr.text();
    expect(stderr).toContain(
      'PlanBridge plugin renamed from cli@contextbridge to planbridge@contextbridge — migrated automatically.',
    );
    expect(stderr).toContain('PlanBridge plugin installed for Claude Code (scope: user)');
  });

  it('with quiet=true performs the same install but suppresses success and migration prose', async () => {
    const { installer, context, io, commandRunner } = setupTest();
    stubClaudeState(commandRunner, { unmanagedPlugins: [{ id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' }] });

    await installer.install(context, { yes: true, quiet: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toHaveLength(1);
    const stderr = io.stderr.text();
    expect(stderr).not.toContain('PlanBridge plugin installed for Claude Code');
    expect(stderr).not.toContain('Restart Claude Code');
    expect(stderr).not.toContain('renamed from cli@contextbridge');
  });

  it('leaves legacy cli@contextbridge alone when it is at a different scope than the install target', async () => {
    const { installer, context, io, commandRunner } = setupTest();
    stubClaudeState(commandRunner, { unmanagedPlugins: [{ id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'project' }] });

    await installer.install(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(io.stderr.text()).not.toContain('renamed from cli@contextbridge');
  });

  it('aborts when claude is not on PATH and never invokes a shellout', () => {
    const { installer, context, commandRunner } = setupTest();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    expect(installer.install(context, { yes: true })).rejects.toThrow('Install Claude Code');
    expect(commandRunner.calls).toEqual([]);
  });

  it('aborts when marketplace-add fails and bubbles stderr', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])
      .resolves({ exitCode: 1, stderr: 'network unreachable' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'update'])).toEqual([]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('network unreachable'))).toBe(true);
  });

  it('aborts when plugin-install fails after a successful marketplace-add', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'install'])
      .resolves({ exitCode: 1, stderr: 'plugin not found in marketplace' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('plugin not found in marketplace'))).toBe(true);
  });

  it('does not remove a legacy install when the new plugin install fails', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    stubClaudeState(commandRunner, { unmanagedPlugins: [{ id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' }] });
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'install'])
      .resolves({ exitCode: 1, stderr: 'plugin not found in marketplace' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('plugin not found in marketplace'))).toBe(true);
  });

  it('does not remove a legacy install when the new plugin update fails', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    stubClaudeState(commandRunner, {
      unmanagedPlugins: [
        { id: CLAUDE_PLUGIN_ID, scope: 'user' },
        { id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' },
      ],
    });
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'update']).resolves({ exitCode: 1, stderr: 'update failed' });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'update'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('update failed'))).toBe(true);
  });

  it('logs a synthetic detail when stderr is empty on a non-zero exit', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves({ exitCode: 3 });

    expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(readLogs(logs).some((r) => r.msg.includes('exited 3'))).toBe(true);
  });
});

describe('ClaudeInstaller.uninstall', () => {
  it('lists, uninstalls, lists marketplaces, removes marketplace, emits confirmation at user scope', async () => {
    const { installer, context, io, commandRunner } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'user' }] }],
    });

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', CLAUDE_PLUGIN_ID, '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'remove', CLAUDE_MARKETPLACE_NAME], opts: {} },
    ]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed from Claude Code (scope: user)');
    expect(io.stdout.text()).toBe('');
  });

  it('skips plugin-uninstall when the plugin is not installed at the user scope', async () => {
    const { installer, context, io, commandRunner, logs } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'project' }] }],
    });

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toHaveLength(1);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
    expect(readLogs(logs).some((r) => r.msg.includes('not installed at scope user'))).toBe(true);
  });

  it('skips marketplace-remove when the marketplace is not configured', async () => {
    const { installer, context, io, commandRunner, logs } = setupTest();
    stubClaudeState(commandRunner, { unmanagedPlugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'user' }] });

    await installer.uninstall(context, { yes: true });

    const uninstallCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall']);
    expect(uninstallCalls).toHaveLength(1);
    expect(uninstallCalls[0]?.args).toEqual(['plugin', 'uninstall', CLAUDE_PLUGIN_ID, '--scope', 'user']);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toEqual([]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
    expect(readLogs(logs).some((r) => r.msg.includes('marketplace is not configured'))).toBe(true);
  });

  it('uninstalls a legacy cli@contextbridge install at the target scope', async () => {
    const { installer, context, io, commandRunner, logs } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' }] }],
    });

    await installer.uninstall(context, { yes: true });

    const uninstallCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall']);
    expect(uninstallCalls).toHaveLength(1);
    expect(uninstallCalls[0]?.args).toEqual(['plugin', 'uninstall', CLAUDE_LEGACY_PLUGIN_ID, '--scope', 'user']);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toHaveLength(1);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
    expect(readLogs(logs).some((r) => r.msg.includes('not installed at scope user'))).toBe(true);
  });

  it('uninstalls both the new id and the legacy cli@contextbridge when both are at the target scope', async () => {
    const { installer, context, commandRunner } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [
        {
          name: CLAUDE_MARKETPLACE_NAME,
          plugins: [
            { id: CLAUDE_PLUGIN_ID, scope: 'user' },
            { id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' },
          ],
        },
      ],
    });

    await installer.uninstall(context, { yes: true });

    const uninstallCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall']);
    expect(uninstallCalls).toHaveLength(2);
    expect(uninstallCalls[0]?.args).toEqual(['plugin', 'uninstall', CLAUDE_PLUGIN_ID, '--scope', 'user']);
    expect(uninstallCalls[1]?.args).toEqual(['plugin', 'uninstall', CLAUDE_LEGACY_PLUGIN_ID, '--scope', 'user']);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toHaveLength(1);
  });

  it('is fully idempotent when both the plugin and marketplace are already absent', async () => {
    const { installer, context, io, commandRunner } = setupTest();

    await installer.uninstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toEqual([]);
    expect(io.stderr.text()).toContain('PlanBridge plugin removed');
  });

  it('aborts when claude is not on PATH and never invokes a shellout', () => {
    const { installer, context, commandRunner } = setupTest();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    expect(installer.uninstall(context, { yes: true })).rejects.toThrow('Install Claude Code');
    expect(commandRunner.calls).toEqual([]);
  });

  it('bubbles a CommanderError and runs no further shellouts when `plugin list --json` fails', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves({ exitCode: 1, stderr: 'permission denied' });

    expect(installer.uninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toHaveLength(1);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('permission denied'))).toBe(true);
  });

  it('bubbles a real plugin-uninstall failure and does not call marketplace-list', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    stubClaudeState(commandRunner, { unmanagedPlugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'user' }] });
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves({ exitCode: 1, stderr: 'disk full' });

    expect(installer.uninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])).toEqual([]);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('disk full'))).toBe(true);
  });

  it('bubbles a real marketplace-remove failure after a clean plugin uninstall', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'user' }] }],
    });
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
    const { installer, context, commandRunner, prompter } = setupTest();
    prompter.setSelect('project');

    await installer.install(context, { yes: false });

    expect(prompter.selectCalls).toHaveLength(1);
    expect(prompter.selectCalls[0]?.message).toBe('Install scope:');
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])[0]?.args).toContain('project');
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])[0]?.args).toContain('project');
  });

  it('skips the scope prompt when yes=true and uses the user-scope default', async () => {
    const { installer, context, commandRunner, prompter } = setupTest();

    await installer.install(context, { yes: true });

    expect(prompter.selectCalls).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])[0]?.args).toContain('user');
  });

  it('prompts for scope on uninstall when yes=false', async () => {
    const { installer, context, commandRunner, prompter } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'project' }] }],
    });
    prompter.setSelect('project');

    await installer.uninstall(context, { yes: false });

    expect(prompter.selectCalls).toHaveLength(1);
    expect(prompter.selectCalls[0]?.message).toBe('Uninstall scope:');
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])[0]?.args).toEqual([
      'plugin',
      'uninstall',
      CLAUDE_PLUGIN_ID,
      '--scope',
      'project',
    ]);
  });
});

describe('ClaudeInstaller.status', () => {
  it('reports detected: false with no managed entries when claude is not on PATH', async () => {
    const { installer, context, commandRunner } = setupTest();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    const status = await installer.status(context);

    expect(status.detected).toBe(false);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([]);
    expect(commandRunner.calls).toEqual([]);
  });

  it('reports detected: true with marketplace and user-scope plugin entries when present', async () => {
    const { installer, context, commandRunner } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'user' }] }],
    });

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.managed).toEqual([
      { kind: 'marketplace', identifier: CLAUDE_MARKETPLACE_NAME },
      { kind: 'plugin', identifier: CLAUDE_PLUGIN_ID, scope: 'user' },
    ]);
  });

  it('reports project-scope plugin installs', async () => {
    const { installer, context, commandRunner } = setupTest();
    stubClaudeState(commandRunner, { unmanagedPlugins: [{ id: CLAUDE_PLUGIN_ID, scope: 'project' }] });

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.managed).toEqual([{ kind: 'plugin', identifier: CLAUDE_PLUGIN_ID, scope: 'project' }]);
  });

  it('reports a legacy cli@contextbridge install as managed but not installed', async () => {
    const { installer, context, commandRunner } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME, plugins: [{ id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' }] }],
    });

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([
      { kind: 'marketplace', identifier: CLAUDE_MARKETPLACE_NAME },
      { kind: 'plugin', identifier: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' },
    ]);
  });

  it('reports both new and legacy plugin entries when both are installed', async () => {
    const { installer, context, commandRunner } = setupTest();
    stubClaudeState(commandRunner, {
      marketplaces: [
        {
          name: CLAUDE_MARKETPLACE_NAME,
          plugins: [
            { id: CLAUDE_PLUGIN_ID, scope: 'user' },
            { id: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' },
          ],
        },
      ],
    });

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.managed).toEqual([
      { kind: 'marketplace', identifier: CLAUDE_MARKETPLACE_NAME },
      { kind: 'plugin', identifier: CLAUDE_PLUGIN_ID, scope: 'user' },
      { kind: 'plugin', identifier: CLAUDE_LEGACY_PLUGIN_ID, scope: 'user' },
    ]);
  });

  it('reports marketplace-only partial state as managed but not installed', async () => {
    const { installer, context, commandRunner } = setupTest();
    stubClaudeState(commandRunner, { marketplaces: [{ name: CLAUDE_MARKETPLACE_NAME }] });

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([{ kind: 'marketplace', identifier: CLAUDE_MARKETPLACE_NAME }]);
  });

  it('reports detected: true with no managed entries when claude is on PATH but PlanBridge is not installed', async () => {
    const { installer, context } = setupTest();

    const status = await installer.status(context);

    expect(status.detected).toBe(true);
    expect(status.installed).toBe(false);
    expect(status.managed).toEqual([]);
  });

  it('bubbles a CommanderError when marketplace status cannot be listed', () => {
    const { installer, context, commandRunner, logs } = setupTest();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves({ exitCode: 2 });

    expect(installer.status(context)).rejects.toBeInstanceOf(CommanderError);
    expect(readErrorLogs(logs).some((r) => r.msg.includes('exited 2'))).toBe(true);
  });
});

function setupTest() {
  const installer = new ClaudeInstaller();
  const stub = createStubContext();
  primeClaudeShellouts(stub.commandRunner);
  return { installer, ...stub };
}
