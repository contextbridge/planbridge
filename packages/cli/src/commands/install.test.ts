import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import {
  CLAUDE_MARKETPLACE_NAME,
  CLAUDE_MARKETPLACE_SOURCE,
  CLAUDE_PLUGIN_ID,
} from '#src/harnesses/ClaudeInstaller.ts';
import { getDescriptor } from '#src/harnesses/registry.ts';
import { environment } from '#src/testFactories.ts';
import { createStubContext, marketplaceListResult, pluginListResult } from '#src/testHelpers/index.ts';
import { runInstall } from './install.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;
const CODEX_BINARY = getDescriptor('codex').binaryName;

describe('runInstall', () => {
  it('with --yes installs Claude when not yet wired up and reports the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();

    await runInstall(context, { yes: true });

    const marketplaceAdd = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']);
    const pluginInstall = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install']);
    expect(marketplaceAdd).toHaveLength(1);
    expect(marketplaceAdd[0]?.args).toEqual([
      'plugin',
      'marketplace',
      'add',
      CLAUDE_MARKETPLACE_SOURCE,
      '--scope',
      'user',
    ]);
    expect(pluginInstall).toHaveLength(1);
    expect(pluginInstall[0]?.args).toEqual(['plugin', 'install', CLAUDE_PLUGIN_ID, '--scope', 'user']);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: not installed');
    expect(stderr).toContain('Installed 1 of 1 detected harness');
  });

  it('skips already-installed harnesses by default and notes them in the summary', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));

    await runInstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toEqual([]);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain(
      'Claude Code: installed (marketplace contextbridge; plugin planbridge@contextbridge @ user)',
    );
    expect(stderr).toContain('Installed 0 of 1 detected harness (1 already installed, skipped).');
  });

  it('with --force re-runs install over an already-installed harness and drops the skipped suffix', async () => {
    const { context, io, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'update']).resolves();

    await runInstall(context, { yes: true, force: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'update'])).toHaveLength(1);
    expect(prompter.calls).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain('Installed 1 of 1 detected harness');
    expect(stderr).not.toContain('skipped');
  });

  it('treats an install at a different scope as already installed and skips by default', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'project' }]));

    await runInstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toEqual([]);
    const stderr = io.stderr.text();
    expect(stderr).toContain(
      'Claude Code: installed (marketplace contextbridge; plugin planbridge@contextbridge @ project)',
    );
    expect(stderr).toContain('(1 already installed, skipped)');
  });

  it('does not skip Claude when only the marketplace is configured', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();

    await runInstall(context, { yes: true });

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])).toHaveLength(1);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toHaveLength(1);
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
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();

    try {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'hooks.json'), '{ bad json');
      writeFileSync(join(configDir, 'config.toml'), '[features]\ncodex_hooks = true\n');

      const err = await captureError(runInstall(context, { yes: true }));
      expect(err).toBeInstanceOf(CommanderError);
      if (!(err instanceof CommanderError)) throw err;
      expect(err.message).toBe('Install failed for: Codex CLI');

      const marketplaceAdd = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']);
      const pluginInstall = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install']);
      expect(marketplaceAdd).toHaveLength(1);
      expect(marketplaceAdd[0]?.args).toEqual([
        'plugin',
        'marketplace',
        'add',
        CLAUDE_MARKETPLACE_SOURCE,
        '--scope',
        'user',
      ]);
      expect(pluginInstall).toHaveLength(1);
      expect(pluginInstall[0]?.args).toEqual(['plugin', 'install', CLAUDE_PLUGIN_ID, '--scope', 'user']);
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
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));
    prompter.setConfirm(false);

    await runInstall(context);

    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add'])).toEqual([]);
    expect(commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install'])).toEqual([]);
    expect(prompter.calls).toEqual([{ message: 'Install PlanBridge into Claude Code?', default: true }]);
    expect(io.stderr.text()).toContain('Claude Code: skipped');
    expect(io.stderr.text()).toContain('Installed 0 of 1 detected harness');
  });

  it('without --yes runs confirm + scope prompts and installs at the chosen scope', async () => {
    const { context, commandRunner, prompter } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']).resolves();
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'install']).resolves();
    prompter.setConfirm(true);
    prompter.setSelect('project');

    await runInstall(context);

    const marketplaceAdd = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'marketplace', 'add']);
    const pluginInstall = commandRunner.callsTo(CLAUDE_BINARY, ['plugin', 'install']);
    expect(marketplaceAdd).toHaveLength(1);
    expect(pluginInstall).toHaveLength(1);
    expect(marketplaceAdd[0]?.args).toContain('project');
    expect(pluginInstall[0]?.args).toContain('project');
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

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (err) {
    return err;
  }
}
