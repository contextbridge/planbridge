import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { getDescriptor } from '#src/harnesses/registry.ts';
import { createStubContext, marketplaceListResult, pluginListResult } from '#src/testHelpers/index.ts';
import { runUninstall } from './uninstall.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;

describe('runUninstall', () => {
  it('with --yes uninstalls when PlanBridge is wired up and reports the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]),
      pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]),
      { exitCode: 0, stdout: '', stderr: '' },
      marketplaceListResult([{ name: 'contextbridge' }]),
      { exitCode: 0, stdout: '', stderr: '' },
    );

    await runUninstall(context, { yes: true });

    const sideEffects = commandRunner.calls.filter((call) => {
      const joined = call.args.join(' ');
      return !joined.endsWith('--json');
    });
    expect(sideEffects).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'cli@contextbridge', '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'remove', 'contextbridge'], opts: {} },
    ]);
    expect(prompter.calls).toEqual([]);
    expect(io.stderr.text()).toContain('Uninstalled 1 of 1 detected harness');
  });

  it('skips harnesses where PlanBridge is not installed and notes them in the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(marketplaceListResult([]), pluginListResult([]));

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
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([]),
      pluginListResult([]),
      marketplaceListResult([{ name: 'contextbridge' }]),
      { exitCode: 0, stdout: '', stderr: '' },
    );

    await runUninstall(context, { yes: true });

    const sideEffects = commandRunner.calls.filter((call) => !call.args.join(' ').endsWith('--json'));
    expect(sideEffects).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'remove', 'contextbridge'], opts: {} },
    ]);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: not installed (marketplace contextbridge)');
    expect(stderr).toContain('Uninstalled 1 of 1 detected harness');
  });

  it('with --force runs uninstall even when nothing is installed and drops the skipped suffix', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([]),
      pluginListResult([]),
      pluginListResult([]),
      marketplaceListResult([]),
    );

    await runUninstall(context, { yes: true, force: true });

    expect(commandRunner.calls).toHaveLength(4);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Uninstalled 1 of 1 detected harness');
    expect(stderr).not.toContain('skipped');
  });

  it('without --yes prompts the user and skips when they decline', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]),
    );
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
