import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { environment } from '#src/testFactories.ts';
import { createStubContext, readErrorLogs, readWarnLogs } from '#src/testHelpers/index.ts';
import { CodexInstaller } from './CodexInstaller.ts';
import { getDescriptor } from './registry.ts';

const CODEX_BINARY = getDescriptor('codex').binaryName;

describe('CodexInstaller', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cb-codex-installer-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe('install', () => {
    it('installs user-scope hook configuration and enables the feature flag', async () => {
      const { installer, context, io } = createCodexInstallerContext(tmp);

      await installer.install(context, { yes: true });

      const hooks = readHooksJson(join(tmp, '.codex', 'hooks.json'));
      expect(hooks.hooks.Stop[0]?.hooks[0]).toMatchObject({
        type: 'command',
        command: 'contextbridge hook codex',
        timeout: 345600,
        statusMessage: 'Opening PlanBridge',
      });
      expect(commandRunnerCalls(context, ['features', 'enable', 'hooks'])).toHaveLength(1);
      expect(commandRunnerCalls(context, ['features', 'disable', 'codex_hooks'])).toHaveLength(1);
      expect(io.stderr.text()).toContain('PlanBridge hook installed for Codex CLI (scope: user)');
      expect(io.stderr.text()).toContain('Action required');
      expect(io.stderr.text()).toContain('PlanBridge will not run in Codex until this hook is trusted');
      expect(io.stderr.text()).toContain('open /hooks');
      expect(io.stderr.text()).toContain('https://plan.contextbridge.ai/usage/codex/#trust-the-codex-hook');
    });

    it('installs project-scope hook configuration under the project root and enables features at user scope', async () => {
      const project = join(tmp, 'project');
      const { installer, context } = createCodexInstallerContext(tmp, { projectRoot: project });

      await installer.install(context, { yes: true, scope: 'project' });

      const hooks = readHooksJson(join(project, '.codex', 'hooks.json'));
      expect(hooks.hooks.Stop[0]?.hooks[0]).toMatchObject({ command: 'contextbridge hook codex' });
      expect(existsSync(join(project, '.codex', 'config.toml'))).toBe(false);
      expect(commandRunnerCalls(context, ['features', 'enable', 'hooks'])).toHaveLength(1);
      expect(commandRunnerCalls(context, ['features', 'disable', 'codex_hooks'])).toHaveLength(1);
    });

    it('is idempotent and preserves other Stop hooks', async () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeHooksJson(join(configDir, 'hooks.json'), {
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'echo other' }] }],
        },
      });
      const { installer, context } = createCodexInstallerContext(tmp);

      await installer.install(context, { yes: true });
      await installer.install(context, { yes: true });

      const hooks = readHooksJson(join(configDir, 'hooks.json'));
      const commands = hooks.hooks.Stop.flatMap((group) => group.hooks.map((hook) => hook.command));
      expect(commands).toEqual(['echo other', 'contextbridge hook codex']);
    });

    it('aborts before writing config when codex is not on PATH', () => {
      const { installer, context, commandRunner } = createCodexInstallerContext(tmp);
      commandRunner.setWhich(CODEX_BINARY, null);

      expect(installer.install(context, { yes: true })).rejects.toThrow('Install Codex CLI first');
      expect(existsSync(join(tmp, '.codex'))).toBe(false);
    });

    it('ignores malformed config.toml because Codex owns feature config', async () => {
      const configDir = join(tmp, '.codex');
      const configPath = join(configDir, 'config.toml');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, '[features\nbroken');
      const { installer, context } = createCodexInstallerContext(tmp);

      await installer.install(context, { yes: true });

      expect(readHooksJson(join(configDir, 'hooks.json')).hooks.Stop[0]?.hooks[0]).toMatchObject({
        command: 'contextbridge hook codex',
      });
      expect(readFileSync(configPath, 'utf8')).toBe('[features\nbroken');
    });

    it('does not run feature commands when hooks.json has an invalid hooks root', () => {
      const configDir = join(tmp, '.codex');
      const configPath = join(configDir, 'config.toml');
      const hooksPath = join(configDir, 'hooks.json');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, '[features]\nunified_exec = true\n');
      writeHooksJson(hooksPath, { hooks: [] });
      const { installer, context } = createCodexInstallerContext(tmp);

      expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
      expect(readFileSync(configPath, 'utf8')).toBe('[features]\nunified_exec = true\n');
      expect(readFileSync(hooksPath, 'utf8')).toBe('{"hooks":[]}');
      expect(commandRunnerCalls(context, ['features', 'enable', 'hooks'])).toHaveLength(0);
    });

    it('fails before writing files when Codex is too old', () => {
      const { installer, context } = createCodexInstallerContext(tmp, {}, { versionStdout: 'codex-cli 0.128.0\n' });

      const installPromise = installer.install(context, { yes: true });
      expect(installPromise).rejects.toBeInstanceOf(CommanderError);
      expect(installPromise).rejects.toThrow('requires Codex CLI 0.129.0 or newer');
      expect(existsSync(join(tmp, '.codex'))).toBe(false);
      expect(commandRunnerCalls(context, ['features', 'enable', 'hooks'])).toHaveLength(0);
    });

    it('fails before writing files when Codex version output is unparseable', () => {
      const { installer, context, logs } = createCodexInstallerContext(tmp, {}, { versionStdout: 'weird\n' });

      const installPromise = installer.install(context, { yes: true });
      expect(installPromise).rejects.toBeInstanceOf(CommanderError);
      expect(installPromise).rejects.toThrow('Could not determine Codex CLI version');
      expect(existsSync(join(tmp, '.codex'))).toBe(false);
      expect(
        readErrorLogs(logs).some(
          (record) => record.msg === 'could not determine Codex CLI version' && record['stdout'] === 'weird\n',
        ),
      ).toBe(true);
    });

    it('fails when Codex feature commands fail', () => {
      const { installer, context } = createCodexInstallerContext(
        tmp,
        {},
        { enableHooksResult: { exitCode: 2, stderr: 'nope' } },
      );

      const installPromise = installer.install(context, { yes: true });
      expect(installPromise).rejects.toBeInstanceOf(CommanderError);
      expect(installPromise).rejects.toThrow(/^nope$/);
    });

    it('continues when disabling the legacy Codex hook feature fails', async () => {
      const { installer, context, logs } = createCodexInstallerContext(
        tmp,
        {},
        { disableLegacyHooksResult: { exitCode: 1, stdout: 'not enabled\n', stderr: 'unknown feature\n' } },
      );

      await installer.install(context, { yes: true });

      expect(readHooksJson(join(tmp, '.codex', 'hooks.json')).hooks.Stop[0]?.hooks[0]).toMatchObject({
        command: 'contextbridge hook codex',
      });
      expect(
        readWarnLogs(logs).some(
          (record) =>
            record.msg === 'codex features disable codex_hooks failed; continuing' &&
            record['stdout'] === 'not enabled\n' &&
            record['stderr'] === 'unknown feature\n',
        ),
      ).toBe(true);
    });
  });

  describe('uninstall', () => {
    it('removes only the PlanBridge Stop hook', async () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeHooksJson(join(configDir, 'hooks.json'), {
        hooks: {
          Stop: [
            {
              hooks: [
                { type: 'command', command: 'echo other' },
                { type: 'command', command: 'contextbridge hook codex' },
              ],
            },
            { hooks: [{ type: 'command', command: 'contextbridge hook codex' }] },
          ],
        },
      });
      const { installer, context, io } = createCodexInstallerContext(tmp);

      await installer.uninstall(context, { yes: true });

      const hooks = readHooksJson(join(configDir, 'hooks.json'));
      expect(hooks.hooks.Stop).toHaveLength(1);
      expect(hooks.hooks.Stop[0]?.hooks).toEqual([{ type: 'command', command: 'echo other' }]);
      expect(io.stderr.text()).toContain('PlanBridge hook removed from Codex CLI (scope: user)');
    });

    it('rejects an invalid hooks root without rewriting hooks.json', () => {
      const configDir = join(tmp, '.codex');
      const hooksPath = join(configDir, 'hooks.json');
      mkdirSync(configDir, { recursive: true });
      writeHooksJson(hooksPath, { hooks: [] });
      const { installer, context } = createCodexInstallerContext(tmp);

      expect(installer.uninstall(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
      expect(readFileSync(hooksPath, 'utf8')).toBe('{"hooks":[]}');
    });
  });

  describe('status', () => {
    it('reports detected: false with no managed entries when codex is not on PATH', async () => {
      const { installer, context, commandRunner } = createCodexInstallerContext(tmp);
      commandRunner.setWhich(CODEX_BINARY, null);

      const status = await installer.status(context);

      expect(status).toMatchObject({
        descriptor: { id: 'codex' },
        detected: false,
        installed: false,
        managed: [],
      });
    });

    it('reports an installed hook when hooks.json is present and Codex is supported', async () => {
      const { installer, context } = createCodexInstallerContext(tmp);
      await installer.install(context, { yes: true });

      const status = await installer.status(context);
      expect(status).toMatchObject({
        descriptor: { id: 'codex' },
        detected: true,
        installed: true,
        managed: [{ kind: 'hook', identifier: 'contextbridge hook codex', scope: 'user' }],
      });
    });

    it('reports hook-only state as installed because install owns feature setup', async () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writePlanBridgeHooksJson(join(configDir, 'hooks.json'));
      const { installer, context } = createCodexInstallerContext(tmp);

      const status = await installer.status(context);

      expect(status.detected).toBe(true);
      expect(status.installed).toBe(true);
      expect(status.managed).toEqual([{ kind: 'hook', identifier: 'contextbridge hook codex', scope: 'user' }]);
    });

    it('does not report managed when hooks.json is absent', async () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      const { installer, context } = createCodexInstallerContext(tmp);

      const status = await installer.status(context);

      expect(status.detected).toBe(true);
      expect(status.installed).toBe(false);
      expect(status.managed).toEqual([]);
    });

    it('bubbles invalid hooks.json as a CommanderError', () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'hooks.json'), '{ bad json');
      const { installer, context } = createCodexInstallerContext(tmp);

      expect(installer.status(context)).rejects.toBeInstanceOf(CommanderError);
    });

    it('bubbles invalid hooks.json shape as a CommanderError', () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeHooksJson(join(configDir, 'hooks.json'), { hooks: [] });
      const { installer, context } = createCodexInstallerContext(tmp);

      expect(installer.status(context)).rejects.toBeInstanceOf(CommanderError);
    });

    it('reports status unavailable when Codex is too old', () => {
      const { installer, context } = createCodexInstallerContext(tmp, {}, { versionStdout: 'codex-cli 0.128.0\n' });

      expect(installer.status(context)).rejects.toBeInstanceOf(CommanderError);
    });
  });
});

interface HooksJson {
  hooks: {
    Stop: Array<{
      hooks: Array<{
        type: string;
        command: string;
        timeout?: number;
        statusMessage?: string;
      }>;
    }>;
  };
}

function createCodexInstallerContext(
  tmp: string,
  overrides: Parameters<typeof createStubContext>[0] = {},
  options: {
    readonly versionStdout?: string;
    readonly enableHooksResult?: { readonly exitCode?: number; readonly stdout?: string; readonly stderr?: string };
    readonly disableLegacyHooksResult?: {
      readonly exitCode?: number;
      readonly stdout?: string;
      readonly stderr?: string;
    };
  } = {},
) {
  const { versionStdout = 'codex-cli 0.129.0\n', enableHooksResult, disableLegacyHooksResult } = options;
  const { env = environment.build({ HOME: tmp }), ...restOverrides } = overrides;
  const testContext = createStubContext({ env, ...restOverrides });
  testContext.commandRunner.setWhich(CODEX_BINARY, '/usr/local/bin/codex');
  testContext.commandRunner.on(CODEX_BINARY, ['--version']).resolves({ stdout: versionStdout });
  testContext.commandRunner.on(CODEX_BINARY, ['features', 'enable', 'hooks']).resolves(enableHooksResult);
  testContext.commandRunner.on(CODEX_BINARY, ['features', 'disable', 'codex_hooks']).resolves(disableLegacyHooksResult);
  return { installer: new CodexInstaller(), ...testContext };
}

function readHooksJson(path: string): HooksJson {
  return JSON.parse(readFileSync(path, 'utf8')) as HooksJson;
}

function writePlanBridgeHooksJson(path: string): void {
  writeHooksJson(path, {
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'contextbridge hook codex' }] }],
    },
  });
}

function writeHooksJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value));
}

function commandRunnerCalls(context: ReturnType<typeof createStubContext>['context'], args: readonly string[]) {
  const commandRunner = context.commandRunner as unknown as {
    callsTo(cmd: string, args: readonly string[]): readonly unknown[];
  };
  return commandRunner.callsTo(CODEX_BINARY, args);
}
