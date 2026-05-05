import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getErrorMessage, hasErrorCode } from '@contextbridge/shared/errors';
import { safeJsonParse } from '@contextbridge/shared/json';
import { isRecord } from '@contextbridge/shared/typeGuards';
import { parse as parseToml, patch as patchToml } from '@decimalturn/toml-patch';
import { CommanderError } from 'commander';
import type { CliContext } from '#src/context.ts';
import { detectHarness } from './detect.ts';
import { type HarnessStatus, type ManagedEntry } from './HarnessInstaller.ts';
import { getSupportedDescriptor } from './registry.ts';
import { INSTALL_SCOPES, type InstallScope, ScopedHarnessInstaller } from './ScopedHarnessInstaller.ts';
import type { SupportedHarnessDescriptor } from './types.ts';

const CODEX_HOOK_COMMAND = 'contextbridge hook codex';
const CODEX_HOOK_TIMEOUT_SECONDS = 345600;
const CODEX_HOOK_STATUS_MESSAGE = 'Opening PlanBridge';

const STOP_HOOK_KEY = 'Stop';

const PLANBRIDGE_STOP_HOOK = {
  type: 'command',
  command: CODEX_HOOK_COMMAND,
  timeout: CODEX_HOOK_TIMEOUT_SECONDS,
  statusMessage: CODEX_HOOK_STATUS_MESSAGE,
} as const;

export class CodexInstaller extends ScopedHarnessInstaller {
  readonly descriptor: SupportedHarnessDescriptor = getSupportedDescriptor('codex');
  protected readonly binaryMissingCode = 'contextbridge.codexInstaller.missingCodex';
  protected readonly configDirName = '.codex';
  protected readonly installDescription = 'Install the PlanBridge Stop hook into Codex CLI.';
  protected readonly uninstallDescription = 'Uninstall the PlanBridge Stop hook from Codex CLI.';

  async status(ctx: CliContext): Promise<HarnessStatus> {
    const detection = detectHarness(ctx, this.descriptor);
    if (!detection.binaryOnPath) {
      return { descriptor: this.descriptor, detected: false, installed: false, managed: [] };
    }

    const managed: ManagedEntry[] = [];
    let installed = false;
    for (const scope of INSTALL_SCOPES) {
      const scopeStatus = await getCodexHookStatusAtScope(ctx, scope);
      if (scopeStatus.hookInstalled) {
        managed.push({ kind: 'hook', identifier: CODEX_HOOK_COMMAND, scope });
      }
      installed = installed || scopeStatus.installed;
    }

    return { descriptor: this.descriptor, detected: true, installed, managed };
  }

  protected async runInstall(ctx: CliContext, scope: InstallScope): Promise<void> {
    const { io } = ctx;
    const configDir = getCodexConfigDir(ctx, scope);
    const hooksPath = join(configDir, 'hooks.json');
    const configPath = join(configDir, 'config.toml');

    await mkdir(configDir, { recursive: true });
    const [hooksSource, configSource] = await Promise.all([readOptionalText(hooksPath), readOptionalText(configPath)]);
    const nextHooks = upsertPlanBridgeHookJson(hooksSource);
    const nextConfig = enableCodexHooksFeatureInToml(configSource);
    await Promise.all([writeFile(hooksPath, nextHooks), writeFile(configPath, nextConfig)]);

    io.stderr.write(`✓ PlanBridge hook installed for Codex CLI (scope: ${scope}).\n`);
    io.stderr.write(`Restart Codex CLI for the hook to load.\n`);
  }

  protected async runUninstall(ctx: CliContext, scope: InstallScope): Promise<void> {
    const { io } = ctx;
    const configDir = getOptionalCodexConfigDir(ctx, scope);

    if (configDir) {
      await removePlanBridgeHook(join(configDir, 'hooks.json'));
    }

    io.stderr.write(`✓ PlanBridge hook removed from Codex CLI (scope: ${scope}).\n`);
  }
}

export function enableCodexHooksFeatureInToml(source: string): string {
  if (source.length === 0) {
    return '[features]\ncodex_hooks = true\n';
  }

  const parsed = parseCodexConfigToml(source);
  const features = isRecord(parsed['features']) ? parsed['features'] : {};
  features['codex_hooks'] = true;
  parsed['features'] = features;

  return patchCodexConfigToml(source, parsed);
}

async function getCodexHookStatusAtScope(
  ctx: CliContext,
  scope: InstallScope,
): Promise<{ hookInstalled: boolean; installed: boolean }> {
  const configDir = getOptionalCodexConfigDir(ctx, scope);
  if (!configDir) return { hookInstalled: false, installed: false };

  const hooksPath = join(configDir, 'hooks.json');
  const configPath = join(configDir, 'config.toml');
  const [hooksInstalled, featureEnabled] = await Promise.all([
    hasPlanBridgeHookInFile(hooksPath),
    hasCodexHooksFeatureEnabled(configPath),
  ]);

  return { hookInstalled: hooksInstalled, installed: hooksInstalled && featureEnabled };
}

function getCodexConfigDir(ctx: CliContext, scope: InstallScope): string {
  const configDir = getOptionalCodexConfigDir(ctx, scope);
  if (!configDir) {
    throw new CommanderError(
      1,
      'contextbridge.codexInstaller.missingHome',
      'HOME is required for user-scope Codex install',
    );
  }
  return configDir;
}

function getOptionalCodexConfigDir(ctx: CliContext, scope: InstallScope): string | null {
  const { env, projectRoot } = ctx;

  if (scope === 'project') {
    return join(projectRoot, '.codex');
  }

  const { HOME } = env;
  return HOME ? join(HOME, '.codex') : null;
}

function upsertPlanBridgeHookJson(source: string): string {
  const hooksFile = parseHooksFileOrDefault(source);
  const hooks = ensureHooksRoot(hooksFile);
  const stopGroups = removePlanBridgeHooksFromGroups(getStopGroups(hooks));

  stopGroups.push({ hooks: [PLANBRIDGE_STOP_HOOK] });
  hooks[STOP_HOOK_KEY] = stopGroups;

  return formatJsonFile(hooksFile);
}

async function removePlanBridgeHook(path: string): Promise<void> {
  const source = await readOptionalText(path);
  if (source.trim().length === 0) {
    return;
  }

  const hooksFile = parseHooksJson(source);
  const hooks = ensureHooksRoot(hooksFile);
  const stopGroups = removePlanBridgeHooksFromGroups(getStopGroups(hooks));

  if (stopGroups.length > 0) {
    hooks[STOP_HOOK_KEY] = stopGroups;
  } else {
    delete hooks[STOP_HOOK_KEY];
  }

  await writeFile(path, formatJsonFile(hooksFile));
}

async function hasPlanBridgeHookInFile(path: string): Promise<boolean> {
  const source = await readOptionalText(path);
  if (source.trim().length === 0) return false;
  return hasPlanBridgeHook(parseHooksJson(source));
}

async function hasCodexHooksFeatureEnabled(path: string): Promise<boolean> {
  const source = await readOptionalText(path);
  if (source.trim().length === 0) return false;

  const parsed = parseCodexConfigToml(source);
  const features = parsed['features'];
  return isRecord(features) && features['codex_hooks'] === true;
}

function parseHooksFileOrDefault(source: string): Record<string, unknown> {
  if (source.trim().length === 0) {
    return { hooks: {} };
  }

  return parseHooksJson(source);
}

function parseHooksJson(source: string): Record<string, unknown> {
  const parsed = safeJsonParse(source).match(
    (value) => value,
    (err) => {
      throw new CommanderError(
        1,
        'contextbridge.codexInstaller.invalidHooksJson',
        `invalid Codex hooks.json: ${getErrorMessage(err)}`,
      );
    },
  );

  if (!isRecord(parsed)) {
    throw new CommanderError(
      1,
      'contextbridge.codexInstaller.invalidHooksJson',
      'Codex hooks.json must contain an object',
    );
  }

  return parsed;
}

async function readOptionalText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (hasErrorCode(err, 'ENOENT')) return '';
    throw err;
  }
}

function formatJsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function ensureHooksRoot(file: Record<string, unknown>): Record<string, unknown> {
  if (!Object.hasOwn(file, 'hooks')) {
    const nextHooks: Record<string, unknown> = {};
    file['hooks'] = nextHooks;
    return nextHooks;
  }

  const hooks = file['hooks'];
  if (isRecord(hooks)) {
    return hooks;
  }

  throw new CommanderError(
    1,
    'contextbridge.codexInstaller.invalidHooksJson',
    'Codex hooks.json `hooks` field must contain an object',
  );
}

function getStopGroups(hooks: Record<string, unknown>): unknown[] {
  const stopGroups = hooks[STOP_HOOK_KEY];
  return Array.isArray(stopGroups) ? stopGroups : [];
}

function removePlanBridgeHooksFromGroups(groups: unknown[]): unknown[] {
  return groups.flatMap((group) => {
    const next = removePlanBridgeHooksFromGroup(group);
    return next === null ? [] : [next];
  });
}

function removePlanBridgeHooksFromGroup(group: unknown): unknown {
  if (!isRecord(group)) {
    return group;
  }

  const hooks = group['hooks'];
  if (!Array.isArray(hooks)) {
    return group;
  }

  const remainingHooks = hooks.filter((hook) => !isPlanBridgeHook(hook));
  if (remainingHooks.length === 0) {
    return null;
  }

  return { ...group, hooks: remainingHooks };
}

function hasPlanBridgeHook(file: Record<string, unknown>): boolean {
  const hooks = getOptionalHooksRoot(file);
  if (!hooks) {
    return false;
  }

  return getStopGroups(hooks).some((group) => {
    if (!isRecord(group)) return false;

    const handlers = group['hooks'];
    return Array.isArray(handlers) && handlers.some(isPlanBridgeHook);
  });
}

function getOptionalHooksRoot(file: Record<string, unknown>): Record<string, unknown> | null {
  if (!Object.hasOwn(file, 'hooks')) {
    return null;
  }

  const hooks = file['hooks'];
  if (isRecord(hooks)) {
    return hooks;
  }

  throw new CommanderError(
    1,
    'contextbridge.codexInstaller.invalidHooksJson',
    'Codex hooks.json `hooks` field must contain an object',
  );
}

function isPlanBridgeHook(value: unknown): boolean {
  return isRecord(value) && value['type'] === 'command' && value['command'] === CODEX_HOOK_COMMAND;
}

function parseCodexConfigToml(source: string): Record<string, unknown> {
  try {
    const parsed = parseToml(source) as unknown;
    if (isRecord(parsed)) return parsed;
    throw new Error('Codex config.toml must contain an object');
  } catch (err) {
    throw new CommanderError(
      1,
      'contextbridge.codexInstaller.invalidConfigToml',
      `invalid Codex config.toml: ${getErrorMessage(err)}`,
    );
  }
}

function patchCodexConfigToml(source: string, value: Record<string, unknown>): string {
  try {
    return patchToml(source, value);
  } catch (err) {
    throw new CommanderError(
      1,
      'contextbridge.codexInstaller.invalidConfigToml',
      `failed to update Codex config.toml: ${getErrorMessage(err)}`,
    );
  }
}
