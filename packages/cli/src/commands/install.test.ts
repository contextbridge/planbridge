import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { getDescriptor } from '#src/harnesses/registry.ts';
import { createStubContext } from '#src/testHelpers/index.ts';
import { runInstall } from './install.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;

describe('runInstall', () => {
  it('with --yes installs detected Claude without prompting and reports the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script({ exitCode: 0, stdout: '', stderr: '' }, { exitCode: 0, stdout: '', stderr: '' });

    await runInstall(context, { yes: true });

    expect(commandRunner.calls).toEqual([
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', 'cli@contextbridge', '--scope', 'user'], opts: {} },
    ]);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: detected');
    expect(stderr).toContain('Installed 1 of 1 detected harness');
  });

  it('without --yes prompts the user and skips when they decline', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    prompter.setConfirm(false);

    await runInstall(context);

    expect(commandRunner.calls).toEqual([]);
    expect(prompter.calls).toEqual([{ message: 'Install PlanBridge into Claude Code?', default: true }]);
    expect(io.stderr.text()).toContain('Claude Code: skipped');
    expect(io.stderr.text()).toContain('Installed 0 of 1 detected harness');
  });

  it('without --yes runs confirm + scope prompts and installs at the chosen scope', async () => {
    const { context, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script({ exitCode: 0, stdout: '', stderr: '' }, { exitCode: 0, stdout: '', stderr: '' });
    prompter.setConfirm(true);
    prompter.setSelect('project');

    await runInstall(context);

    expect(commandRunner.calls).toHaveLength(2);
    expect(commandRunner.calls[0]?.args).toContain('project');
    expect(prompter.calls).toHaveLength(1);
    expect(prompter.selectCalls).toHaveLength(1);
    expect(prompter.selectCalls[0]?.message).toBe('Install scope:');
  });

  it('throws when no supported harnesses are detected', () => {
    const { context, commandRunner, io } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    expect(runInstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
    expect(commandRunner.calls).toEqual([]);
    expect(io.stderr.text()).toContain('Claude Code: not detected');
  });
});
