#!/usr/bin/env bun
/**
 * Bridges Changesets versioning into ContextBridge's existing GitHub release
 * contract.
 *
 * Changesets owns package version bumps and changelog generation, but its
 * built-in git tags are not configurable: single-package repos get `vX.Y.Z`,
 * while workspace repos get `<package>@X.Y.Z`. This repo is a Bun workspace and
 * the release pipeline, installer docs, update notices, GoReleaser workflow, and
 * download aliases all key off the historical `vX.Y.Z` tag shape.
 *
 * Keep Changesets' private package tagging disabled and use this script as the
 * narrow compatibility bridge that creates the `vX.Y.Z` GitHub release/tag from
 * the root package version and root changelog entry.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';

const ROOT_PACKAGE_PATH = 'package.json';
const CHANGELOG_PATH = 'CHANGELOG.md';
const NOT_FOUND_PATTERN = /\b(?:HTTP 404|not found)\b/i;

function main(): void {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const version = readRootVersion();
  const tag = `v${version}`;

  if (!semver.valid(version)) {
    error(`root package version '${version}' is not valid semver`);
  }

  const body = extractChangelogEntry(version);

  if (getReleaseState(tag) === 'exists') {
    log(`GitHub release ${tag} already exists; skipping.`);
    return;
  }

  const target = resolveReleaseTarget();

  if (dryRun) {
    log(`Would create GitHub release ${tag} at ${target}.`);
    log(body);
    return;
  }

  const { dir, notesPath } = writeTemporaryReleaseNotes(body);
  try {
    run('gh', ['release', 'create', tag, '--target', target, '--title', tag, '--notes-file', notesPath]);
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

function resolveReleaseTarget(): string {
  const githubSha = process.env['GITHUB_SHA']?.trim();
  if (githubSha) return githubSha;

  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0) {
    error(`could not resolve release target: ${result.stderr.trim() || 'git rev-parse HEAD failed'}`);
  }

  const target = result.stdout.trim();
  if (target === '') {
    error('could not resolve release target: git rev-parse HEAD returned no output');
  }
  return target;
}

function getReleaseState(tag: string): 'exists' | 'missing' {
  const result = spawnSync('gh', ['release', 'view', tag, '--json', 'tagName'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status === 0) return 'exists';

  const diagnostics = [result.stderr, result.stdout, result.error?.message].filter(Boolean).join('\n').trim();
  if (NOT_FOUND_PATTERN.test(diagnostics)) return 'missing';

  error(
    `could not check GitHub release ${tag}: ${diagnostics || `gh exited with status ${result.status ?? 'unknown'}`}`,
  );
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
