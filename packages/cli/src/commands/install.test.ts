import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { getDescriptor } from '#src/harnesses/registry.ts';
import { environment } from '#src/testFactories.ts';
import {
  type FakeCommandCall,
  type FakeCommandRunner,
  createStubContext,
  marketplaceListResult,
  pluginListResult,
} from '#src/testHelpers/index.ts';
import { runInstall } from './install.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;
const CODEX_BINARY = getDescriptor('codex').binaryName;

describe('runInstall', () => {
  it('with --yes installs Claude when not yet wired up and reports the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([]),
      pluginListResult([]),
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
    );

    await runInstall(context, { yes: true });

    expect(installCalls(commandRunner)).toEqual([
      {
        cmd: CLAUDE_BINARY,
        args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
        opts: {},
      },
      { cmd: CLAUDE_BINARY, args: ['plugin', 'install', 'cli@contextbridge', '--scope', 'user'], opts: {} },
    ]);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: not installed');
    expect(stderr).toContain('Installed 1 of 1 detected harness');
  });

  it('skips already-installed harnesses by default and notes them in the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]),
    );

    await runInstall(context, { yes: true });

    expect(installCalls(commandRunner)).toEqual([]);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: installed (marketplace contextbridge; plugin cli@contextbridge @ user)');
    expect(stderr).toContain('Installed 0 of 1 detected harness (1 already installed, skipped).');
  });

  it('with --force re-runs install over an already-installed harness and drops the skipped suffix', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]),
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
    );

    await runInstall(context, { yes: true, force: true });

    expect(installCalls(commandRunner)).toHaveLength(2);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Installed 1 of 1 detected harness');
    expect(stderr).not.toContain('skipped');
  });

  it('treats an install at a different scope as already installed and skips by default', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([{ id: 'cli@contextbridge', scope: 'project' }]),
    );

    await runInstall(context, { yes: true });

    expect(installCalls(commandRunner)).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: installed (marketplace contextbridge; plugin cli@contextbridge @ project)');
    expect(stderr).toContain('(1 already installed, skipped)');
  });

  it('does not skip Claude when only the marketplace is configured', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([]),
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
    );

    await runInstall(context, { yes: true });

    expect(installCalls(commandRunner)).toHaveLength(2);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: not installed (marketplace contextbridge)');
    expect(stderr).toContain('Installed 1 of 1 detected harness');
    expect(stderr).not.toContain('already installed, skipped');
  });

  it('records a status failure for one harness and still installs another detected harness', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cb-cli-install-status-failure-'));
    const { context, io, commandRunner } = createStubContext({ env: environment.build({ HOME: tmp }) });
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.setWhich(CODEX_BINARY, '/usr/local/bin/codex');
    commandRunner.script(
      marketplaceListResult([]),
      pluginListResult([]),
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
    );

    try {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'hooks.json'), '{ bad json');
      writeFileSync(join(configDir, 'config.toml'), '[features]\ncodex_hooks = true\n');

      const err = await captureError(runInstall(context, { yes: true }));
      expect(err).toBeInstanceOf(CommanderError);
      if (!(err instanceof CommanderError)) throw err;
      expect(err.message).toBe('Install failed for: Codex CLI');

      expect(installCalls(commandRunner)).toEqual([
        {
          cmd: CLAUDE_BINARY,
          args: ['plugin', 'marketplace', 'add', 'contextbridge/claude-plugin', '--scope', 'user'],
          opts: {},
        },
        { cmd: CLAUDE_BINARY, args: ['plugin', 'install', 'cli@contextbridge', '--scope', 'user'], opts: {} },
      ]);
      const stderr = io.stderr.text();
      expect(stderr).toContain('Codex CLI: status unavailable (invalid Codex hooks.json');
      expect(stderr).toContain('Installed 1 of 2 detected harnesses.');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('without --yes prompts the user and skips when they decline', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(marketplaceListResult([]), pluginListResult([]));
    prompter.setConfirm(false);

    await runInstall(context);

    expect(installCalls(commandRunner)).toEqual([]);
    expect(prompter.calls).toEqual([{ message: 'Install PlanBridge into Claude Code?', default: true }]);
    expect(io.stderr.text()).toContain('Claude Code: skipped');
    expect(io.stderr.text()).toContain('Installed 0 of 1 detected harness');
  });

  it('without --yes runs confirm + scope prompts and installs at the chosen scope', async () => {
    const { context, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([]),
      pluginListResult([]),
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
    );
    prompter.setConfirm(true);
    prompter.setSelect('project');

    await runInstall(context);

    const calls = installCalls(commandRunner);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args).toContain('project');
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

function installCalls(commandRunner: FakeCommandRunner): FakeCommandCall[] {
  return commandRunner.calls.filter((call) => {
    const joined = call.args.join(' ');
    return joined !== 'plugin marketplace list --json' && joined !== 'plugin list --json';
  });
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (err) {
    return err;
  }
}
