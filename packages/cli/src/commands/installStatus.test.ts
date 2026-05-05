import { describe, expect, it } from 'bun:test';
import { getDescriptor } from '#src/harnesses/registry.ts';
import { createStubContext, marketplaceListResult, parseStdoutJson, pluginListResult } from '#src/testHelpers/index.ts';
import { runInstallStatus } from './installStatus.ts';

const CLAUDE_BINARY = getDescriptor('claude').binaryName;

describe('runInstallStatus', () => {
  it('writes prose to stderr and leaves stdout empty by default when PlanBridge is fully wired', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]),
    );

    await runInstallStatus(context);

    const stderr = io.stderr.text();
    expect(stderr).toContain('Claude Code: installed');
    expect(stderr).toContain('marketplace contextbridge');
    expect(stderr).toContain('plugin cli@contextbridge @ user');
    expect(io.stdout.text()).toBe('');
  });

  it('reports "not installed" when claude is on PATH but PlanBridge is absent', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(marketplaceListResult([]), pluginListResult([]));

    await runInstallStatus(context);

    expect(io.stderr.text()).toContain('Claude Code: not installed');
  });

  it('reports project-scope Claude installs', async () => {
    const { context, io, commandRunner } = createStubContext();
    commandRunner.setWhich(CLAUDE_BINARY, '/usr/local/bin/claude');
    commandRunner.script(marketplaceListResult([]), pluginListResult([{ id: 'cli@contextbridge', scope: 'project' }]));

    await runInstallStatus(context);

    expect(io.stderr.text()).toContain('plugin cli@contextbridge @ project');
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
    commandRunner.script(
      marketplaceListResult([{ name: 'contextbridge' }]),
      pluginListResult([{ id: 'cli@contextbridge', scope: 'user' }]),
    );

    await runInstallStatus(context, { json: true });

    expect(io.stderr.text()).toBe('');
    const payload = parseStdoutJson(io) as unknown[];
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({
      descriptor: { id: 'claude' },
      detected: true,
      managed: [
        { kind: 'marketplace', identifier: 'contextbridge' },
        { kind: 'plugin', identifier: 'cli@contextbridge', scope: 'user' },
      ],
    });
    expect(payload[1]).toMatchObject({
      descriptor: { id: 'codex' },
      detected: false,
      managed: [],
    });
  });
});
