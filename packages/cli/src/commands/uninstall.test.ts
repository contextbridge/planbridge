import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { getDescriptor } from '#src/harnesses/registry.ts';
import { createStubContext, marketplaceListResult, pluginListResult } from '#src/testHelpers/index.ts';
import { runUninstall } from './uninstall.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;

describe('runUninstall', () => {
  it('with --yes uninstalls detected Claude without prompting and reports the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]),
      { exitCode: 0, stdout: '', stderr: '' },
      marketplaceListResult([{ name: 'contextbridge' }]),
      { exitCode: 0, stdout: '', stderr: '' },
    );

    await runUninstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      { cmd: CLAUDE_BINARY, args: ['plugin', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'uninstall', 'cli@contextbridge', '--scope', 'user'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'list', '--json'], opts: {} },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'marketplace', 'remove', 'contextbridge'], opts: {} },
    ]);
    expect(prompter.calls).toEqual([]);
    expect(io.stderr.text()).toContain('Uninstalled 1 of 1 detected harness');
  });

  it('without --yes prompts the user and skips when they decline', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    prompter.setConfirm(false);

    await runUninstall(context);

    expect(commandRunner.calls).toEqual([]);
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
