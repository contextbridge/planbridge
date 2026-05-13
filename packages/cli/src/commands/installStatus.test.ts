import { getHarness } from '@contextbridge/harness';
import { describe, expect, it } from 'bun:test';
import { CLAUDE_MARKETPLACE_NAME, CLAUDE_PLUGIN_ID } from '#src/harnesses/ClaudeInstaller.ts';
import { createStubContext, marketplaceListResult, parseStdoutJson, pluginListResult } from '#src/testHelpers/index.ts';
import { runInstallStatus } from './installStatus.ts';

const CLAUDE_BINARY = getHarness('claude').binaryName;

describe('runInstallStatus', () => {
  it('writes prose to stderr and leaves stdout empty by default when PlanBridge is fully wired', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));

    await runInstallStatus(context);

    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: PlanBridge installed');
    expect(stderr).toContain('marketplace contextbridge');
    expect(stderr).toContain('plugin planbridge@contextbridge @ user');
    expect(io.stdout.text()).toBe('');
  });

  it('reports "not installed" when claude is on PATH but PlanBridge is absent', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));

    await runInstallStatus(context);

    expect(io.stderr.text()).toContain('Claude Code: PlanBridge not installed');
  });

  it('reports partial Claude artifacts without calling them installed', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'list', '--json']).resolves(pluginListResult([]));

    await runInstallStatus(context);

    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: PlanBridge not installed (marketplace contextbridge)');
    expect(stderr).not.toContain('Claude Code: PlanBridge installed');
  });

  it('reports project-scope Claude installs', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json']).resolves(marketplaceListResult([]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'project' }]));

    await runInstallStatus(context);

    expect(io.stderr.text()).toContain('plugin planbridge@contextbridge @ project');
  });

  it('reports "not detected" when claude is not on PATH and runs no shellouts', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, null);

    await runInstallStatus(context);

    expect(io.stderr.text()).toContain('Claude Code: not detected');
    expect(commandRunner.calls).toEqual([]);
  });

  it('with --json writes machine-readable JSON to stdout and leaves stderr empty', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'marketplace', 'list', '--json'])
      .resolves(marketplaceListResult([{ name: CLAUDE_MARKETPLACE_NAME }]));
    commandRunner
      .on(CLAUDE_BINARY, ['plugin', 'list', '--json'])
      .resolves(pluginListResult([{ id: CLAUDE_PLUGIN_ID, scope: 'user' }]));

    await runInstallStatus(context, { json: true });

    expect(io.stderr.text()).toBe('');
    const payload = parseStdoutJson(io) as unknown[];
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({
      descriptor: { id: 'claude' },
      detected: true,
      installed: true,
      managed: [
        { kind: 'marketplace', identifier: CLAUDE_MARKETPLACE_NAME },
        { kind: 'plugin', identifier: CLAUDE_PLUGIN_ID, scope: 'user' },
      ],
    });
    expect(payload[1]).toMatchObject({
      descriptor: { id: 'codex' },
      detected: false,
      installed: false,
      managed: [],
    });
  });
});
