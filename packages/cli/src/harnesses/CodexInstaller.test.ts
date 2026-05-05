import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { environment } from '#src/testFactories.ts';
import { createStubContext } from '#src/testHelpers/index.ts';
import { CodexInstaller, enableCodexHooksFeatureInToml } from './CodexInstaller.ts';
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
      expect(readFileSync(join(tmp, '.codex', 'config.toml'), 'utf8')).toContain('codex_hooks = true');
      expect(io.stderr.text()).toContain('PlanBridge hook installed for Codex CLI (scope: user)');
    });

    it('installs project-scope hook configuration under the project root', async () => {
      const project = join(tmp, 'project');
      const { installer, context } = createCodexInstallerContext(tmp, { projectRoot: project });

      await installer.install(context, { yes: true, scope: 'project' });

      const hooks = readHooksJson(join(project, '.codex', 'hooks.json'));
      expect(hooks.hooks.Stop[0]?.hooks[0]).toMatchObject({ command: 'contextbridge hook codex' });
      expect(readFileSync(join(project, '.codex', 'config.toml'), 'utf8')).toContain('codex_hooks = true');
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

    it('does not write hooks.json when config.toml is malformed', () => {
      const configDir = join(tmp, '.codex');
      const configPath = join(configDir, 'config.toml');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, '[features\nbroken');
      const { installer, context } = createCodexInstallerContext(tmp);

      expect(installer.install(context, { yes: true })).rejects.toBeInstanceOf(CommanderError);
      expect(existsSync(join(configDir, 'hooks.json'))).toBe(false);
      expect(readFileSync(configPath, 'utf8')).toBe('[features\nbroken');
    });

    it('does not update config.toml when hooks.json has an invalid hooks root', () => {
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

    it('reports an installed hook only when hooks.json and config.toml are both valid', async () => {
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

    it('reports hook-only partial state as managed but not installed', async () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writePlanBridgeHooksJson(join(configDir, 'hooks.json'));
      const { installer, context } = createCodexInstallerContext(tmp);

      const status = await installer.status(context);

      expect(status.detected).toBe(true);
      expect(status.installed).toBe(false);
      expect(status.managed).toEqual([{ kind: 'hook', identifier: 'contextbridge hook codex', scope: 'user' }]);
    });

    it('does not report managed when the feature flag exists but hooks.json is absent', async () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'config.toml'), '[features]\ncodex_hooks = true\n');
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
      writeFileSync(join(configDir, 'config.toml'), '[features]\ncodex_hooks = true\n');
      const { installer, context } = createCodexInstallerContext(tmp);

      expect(installer.status(context)).rejects.toBeInstanceOf(CommanderError);
    });

    it('bubbles invalid hooks.json shape as a CommanderError', () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writeHooksJson(join(configDir, 'hooks.json'), { hooks: [] });
      writeFileSync(join(configDir, 'config.toml'), '[features]\ncodex_hooks = true\n');
      const { installer, context } = createCodexInstallerContext(tmp);

      expect(installer.status(context)).rejects.toBeInstanceOf(CommanderError);
    });

    it('bubbles invalid config.toml as a CommanderError', () => {
      const configDir = join(tmp, '.codex');
      mkdirSync(configDir, { recursive: true });
      writePlanBridgeHooksJson(join(configDir, 'hooks.json'));
      writeFileSync(join(configDir, 'config.toml'), '[features\nbroken');
      const { installer, context } = createCodexInstallerContext(tmp);

      expect(installer.status(context)).rejects.toBeInstanceOf(CommanderError);
    });
  });
});

describe('enableCodexHooksFeatureInToml', () => {
  it('adds a features table when the file is empty', () => {
    expect(enableCodexHooksFeatureInToml('')).toBe('[features]\ncodex_hooks = true\n');
  });

  it('inserts into an existing features table', () => {
    expect(enableCodexHooksFeatureInToml('[features]\nunified_exec = true\n')).toBe(
      '[features]\nunified_exec = true\ncodex_hooks = true\n',
    );
  });

  it('updates an existing flag', () => {
    expect(enableCodexHooksFeatureInToml('[features]\ncodex_hooks = false\n')).toBe('[features]\ncodex_hooks = true\n');
  });

  it('returns the source unchanged when the flag is already true', () => {
    const source = '# user comment\n[features]  # inline\n  codex_hooks = true\nunified_exec = true\n';
    expect(enableCodexHooksFeatureInToml(source)).toBe(source);
  });

  it('throws on malformed TOML rather than silently overwriting', () => {
    expect(() => enableCodexHooksFeatureInToml('[features\nbroken')).toThrow();
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

function createCodexInstallerContext(tmp: string, overrides: Parameters<typeof createStubContext>[0] = {}) {
  const { env = environment.build({ HOME: tmp }), ...restOverrides } = overrides;
  const testContext = createStubContext({ env, ...restOverrides });
  testContext.commandRunner.setWhich(CODEX_BINARY, '/usr/local/bin/codex');
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
