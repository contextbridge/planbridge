#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';

const ROOT_PACKAGE_PATH = 'package.json';
const CHANGELOG_PATH = 'CHANGELOG.md';

// Changesets owns the version and changelog. This publish command preserves the
// repo's existing v* release tags, which trigger the GoReleaser workflow.
function main(): void {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const version = readRootVersion();
  const tag = `v${version}`;

  if (!semver.valid(version)) {
    error(`root package version '${version}' is not valid semver`);
  }

  const body = extractChangelogEntry(version);

  if (releaseExists(tag)) {
    log(`GitHub release ${tag} already exists; skipping.`);
    return;
  }

  if (dryRun) {
    log(`Would create GitHub release ${tag}.`);
    log(body);
    return;
  }

  const { dir, notesPath } = writeTemporaryReleaseNotes(body);
  try {
    run('gh', ['release', 'create', tag, '--title', tag, '--notes-file', notesPath]);
    log(`New tag: ${tag}`);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function readRootVersion(): string {
  const packageJson = JSON.parse(readFileSync(ROOT_PACKAGE_PATH, 'utf8')) as {
    version?: unknown;
  };
  if (typeof packageJson.version !== 'string' || packageJson.version.trim() === '') {
    error(`root ${ROOT_PACKAGE_PATH} is missing a string version`);
  }
  return packageJson.version;
}

function extractChangelogEntry(version: string): string {
  const changelog = readFileSync(CHANGELOG_PATH, 'utf8');
  const headingPattern = new RegExp(`^##\\s+(?:\\[)?${escapeRegExp(version)}(?:\\])?.*$`, 'm');
  const match = headingPattern.exec(changelog);
  if (!match) {
    error(`could not find ${version} in ${CHANGELOG_PATH}`);
  }

  const start = match.index + match[0].length;
  const nextHeading = /^##\s+/m.exec(changelog.slice(start));
  const end = nextHeading ? start + nextHeading.index : changelog.length;
  const body = changelog.slice(start, end).trim();
  if (body === '') {
    error(`changelog entry for ${version} is empty`);
  }
  return body;
}

function releaseExists(tag: string): boolean {
  const result = spawnSync('gh', ['release', 'view', tag], { stdio: 'ignore' });
  return result.status === 0;
}

function writeTemporaryReleaseNotes(body: string): { readonly dir: string; readonly notesPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'contextbridge-release-'));
  const notesPath = join(dir, 'notes.md');
  writeFileSync(notesPath, `${body}\n`);
  return { dir, notesPath };
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    error(`command failed: ${command} ${args.join(' ')}`);
  }
}

function log(message: string): void {
  console.log(message);
}

function error(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();
