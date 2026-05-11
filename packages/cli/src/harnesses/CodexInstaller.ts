import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getErrorMessage, hasErrorCode } from '@contextbridge/shared/errors';
import { safeJsonParse } from '@contextbridge/shared/json';
import { isRecord } from '@contextbridge/shared/typeGuards';
import { CommanderError } from 'commander';
import semver from 'semver';
import type { CliContext } from '#src/context.ts';
import { detectHarness } from './detect.ts';
import { type HarnessStatus, type ManagedEntry } from './HarnessInstaller.ts';
import { getSupportedDescriptor } from './registry.ts';
import { INSTALL_SCOPES, type InstallScope, ScopedHarnessInstaller } from './ScopedHarnessInstaller.ts';
import type { SupportedHarnessDescriptor } from './types.ts';

const CODEX_HOOK_COMMAND = 'contextbridge hook codex';
const CODEX_HOOK_TIMEOUT_SECONDS = 345600;
const CODEX_HOOK_STATUS_MESSAGE = 'Opening PlanBridge';
// 0.129.0 introduced the replacement `hooks` feature flag for the deprecated `codex_hooks` flag.
const MINIMUM_CODEX_VERSION = '0.129.0';

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

    await requireSupportedCodexVersion(ctx, this.descriptor.binaryName);

    const managed: ManagedEntry[] = [];
    let installed = false;
    for (const scope of INSTALL_SCOPES) {
      const hookInstalled = await getCodexHookStatusAtScope(ctx, scope);
      if (hookInstalled) {
        managed.push({ kind: 'hook', identifier: CODEX_HOOK_COMMAND, scope });
      }
      installed = installed || hookInstalled;
    }

    return { descriptor: this.descriptor, detected: true, installed, managed };
  }

  protected async runInstall(ctx: CliContext, scope: InstallScope): Promise<void> {
    const { io } = ctx;
    await requireSupportedCodexVersion(ctx, this.descriptor.binaryName);

    const configDir = getCodexConfigDir(ctx, scope);
    const hooksPath = join(configDir, 'hooks.json');

    await mkdir(configDir, { recursive: true });
    const hooksSource = await readOptionalText(hooksPath);
    const nextHooks = upsertPlanBridgeHookJson(hooksSource);
    await writeFile(hooksPath, nextHooks);
    await enableCodexHookFeatureFlags(ctx, this.descriptor.binaryName);

    io.stderr.write(`✓ PlanBridge hook installed for Codex CLI (scope: ${scope}).\n`);
    io.stderr.write(`Action required: PlanBridge will not run in Codex until this hook is trusted.\n`);
    io.stderr.write(
      `Restart Codex CLI, open /hooks, verify the Stop hook runs \`${CODEX_HOOK_COMMAND}\`, and press t.\n`,
    );
    io.stderr.write(`Walkthrough: https://plan.contextbridge.ai/usage/codex/#trust-the-codex-hook\n`);
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

async function getCodexHookStatusAtScope(ctx: CliContext, scope: InstallScope): Promise<boolean> {
  const configDir = getOptionalCodexConfigDir(ctx, scope);
  if (!configDir) return false;

  const hooksPath = join(configDir, 'hooks.json');
  return hasPlanBridgeHookInFile(hooksPath);
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

async function requireSupportedCodexVersion(ctx: CliContext, binaryName: string): Promise<void> {
  const { logger } = ctx;
  const result = await runCodexCommand(ctx, binaryName, ['--version'], 'version check');
  const parsed = parseCodexVersion(result.stdout);
  if (!parsed) {
    logger.error({ stdout: result.stdout }, 'could not determine Codex CLI version');
    throw new CommanderError(
      1,
      'contextbridge.codexInstaller.unsupportedVersion',
      `Could not determine Codex CLI version from \`${binaryName} --version\`. Update Codex CLI to ${MINIMUM_CODEX_VERSION} or newer, then re-run install.`,
    );
  }

  if (!semver.gte(parsed, MINIMUM_CODEX_VERSION)) {
    throw new CommanderError(
      1,
      'contextbridge.codexInstaller.unsupportedVersion',
      `Codex CLI ${parsed} is installed, but PlanBridge requires Codex CLI ${MINIMUM_CODEX_VERSION} or newer. Update Codex CLI, then re-run install.`,
    );
  }
}

async function enableCodexHookFeatureFlags(ctx: CliContext, binaryName: string): Promise<void> {
  await runCodexCommand(ctx, binaryName, ['features', 'enable', 'hooks'], 'features enable hooks');
  await tryRunCodexCommand(ctx, binaryName, ['features', 'disable', 'codex_hooks'], 'features disable codex_hooks');
}

async function runCodexCommand(
  ctx: CliContext,
  binaryName: string,
  args: readonly string[],
  label: string,
): Promise<{ stdout: string; stderr: string }> {
  const { commandRunner, logger } = ctx;
  const result = await commandRunner.run(binaryName, args);

  logger.debug(
    { args, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr },
    `${binaryName} ${label}`,
  );

  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || `${binaryName} ${label} exited ${result.exitCode}`;
    logger.error(detail);
    throw new CommanderError(result.exitCode, 'contextbridge.codexInstaller.shellFailure', detail);
  }

  return result;
}

async function tryRunCodexCommand(
  ctx: CliContext,
  binaryName: string,
  args: readonly string[],
  label: string,
): Promise<void> {
  const { commandRunner, logger } = ctx;
  try {
    const result = await commandRunner.run(binaryName, args);
    if (result.exitCode === 0) {
      logger.debug(
        { args, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr },
        `${binaryName} ${label}`,
      );
      return;
    }

    logger.warn(
      { args, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr },
      `${binaryName} ${label} failed; continuing`,
    );
  } catch (err) {
    logger.warn({ err, args }, `${binaryName} ${label} failed; continuing`);
  }
}

function parseCodexVersion(source: string): string | null {
  for (const line of source.split(/\r?\n/)) {
    const match = /^codex(?:-cli)?\s+v?(\d+\.\d+\.\d+(?:[-+][^\s]+)?)\s*$/.exec(line.trim());
    if (match) {
      return match[1] ?? null;
    }
  }
  return null;
}
