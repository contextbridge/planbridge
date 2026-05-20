#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT_PACKAGE_PATH = 'package.json';
const CLAUDE_PLUGIN_MANIFEST_PATH = 'harnessIntegrations/claude/.claude-plugin/plugin.json';

function main(): void {
  const rootPackage = readJsonFile<PackageJson>(ROOT_PACKAGE_PATH);
  const pluginManifest = readJsonFile<ClaudePluginManifest>(CLAUDE_PLUGIN_MANIFEST_PATH);

  pluginManifest.version = rootPackage.version;
  writeFileSync(CLAUDE_PLUGIN_MANIFEST_PATH, `${JSON.stringify(pluginManifest, null, 2)}\n`);
}

type PackageJson = {
  readonly version: string;
};

type ClaudePluginManifest = {
  version: string;
};

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

main();
