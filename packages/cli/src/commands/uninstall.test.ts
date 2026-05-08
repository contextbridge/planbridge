import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { CLAUDE_MARKETPLACE_NAME, CLAUDE_PLUGIN_ID } from '#src/harnesses/ClaudeInstaller.ts';
import { getDescriptor } from '#src/harnesses/registry.ts';
import { createStubContext, marketplaceListResult, pluginListResult } from '#src/testHelpers/index.ts';
import { runUninstall } from './uninstall.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;

describe('runUninstall', () => {
  it('with --yes uninstalls when PlanBridge is wired up and reports the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'uninstall']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();

    await runUninstall(context, { yes: true });

    const uninstallCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall']);
    const marketplaceRemoveCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']);
    expect(uninstallCalls).toHaveLength(1);
    expect(uninstallCalls[0]?.args).toEqual(['plugin', 'uninstall', CLAUDE_PLUGIN_ID, '--scope', 'user']);
    expect(marketplaceRemoveCalls).toHaveLength(1);
    expect(marketplaceRemoveCalls[0]?.args).toEqual(['plugin', 'marketplace', 'remove', CLAUDE_MARKETPLACE_NAME]);
    expect(prompter.calls).toEqual([]);
    expect(io.stderr.text()).toContain('Uninstalled 1 of 1 detected harness');
  });

  it('skips harnesses where PlanBridge is not installed and notes them in the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));

    await runUninstall(context, { yes: true });

    expect(commandRunner.calls).toHaveLength(2);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: not installed');
    expect(stderr).toContain('Uninstalled 0 of 1 detected harness (1 not installed, skipped).');
  });

  it('cleans up Claude marketplace-only partial installs instead of treating them as already uninstalled', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']).resolves();

    await runUninstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    const marketplaceRemoveCalls = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove']);
    expect(marketplaceRemoveCalls).toHaveLength(1);
    expect(marketplaceRemoveCalls[0]?.args).toEqual(['plugin', 'marketplace', 'remove', CLAUDE_MARKETPLACE_NAME]);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: not installed (marketplace contextbridge)');
    expect(stderr).toContain('Uninstalled 1 of 1 detected harness');
  });

  it('with --force runs uninstall even when nothing is installed and drops the skipped suffix', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));

    await runUninstall(context, { yes: true, force: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'uninstall'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'remove'])).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Uninstalled 1 of 1 detected harness');
    expect(stderr).not.toContain('skipped');
  });

  it('without --yes prompts the user and skips when they decline', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));
    prompter.setConfirm(false);

    await runUninstall(context);

    expect(prompter.calls).toEqual([{ message: 'Remove PlanBridge from Claude Code?', default: true }]);
    expect(io.stderr.text()).toContain('Claude Code: skipped');
    expect(io.stderr.text()).toContain('Uninstalled 0 of 1 detected harness');
  });

  it('throws when no supported harnesses are detected', () => {
    const { context, commandRunner, io } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    expect(runUninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toEqual([]);
    expect(io.stderr.text()).toContain('Claude Code: not detected');
  });
});
