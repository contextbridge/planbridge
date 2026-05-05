#!/usr/bin/env bun
import { execSync } from 'node:child_process';
import semver from 'semver';

const RELEASE_TYPES = ['major', 'minor', 'patch'] as const;
type ReleaseType = (typeof RELEASE_TYPES)[number];

function main(): void {
  const increment = process.argv[2];
  if (!increment || !RELEASE_TYPES.includes(increment as ReleaseType)) {
    error('usage: releaseStable.ts <major|minor|patch>');
  }

  if (run('git status --porcelain').length > 0) {
    error('working tree is not clean. Commit or stash changes first.');
  }

  const currentBranch = run('git branch --show-current');
  if (currentBranch !== 'main') {
    error(`must be on 'main' branch (currently on '${currentBranch}')`);
  }

  const latestVersion = getLatestStableVersion();
  console.log(`Latest stable version: ${latestVersion}`);

  const newVersion = semver.inc(latestVersion, increment as ReleaseType);
  if (!newVersion) {
    error(`failed to increment version '${latestVersion}'`);
  }

  const newTag = `v${newVersion}`;
  console.log(`New version: ${newVersion}`);

  run(`git tag ${newTag}`);
  run(`git push origin ${newTag}`);
  console.log(`Released ${newTag}`);
}

function run(command: string): string {
  return execSync(command, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function error(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function getLatestStableVersion(): string {
  let output: string;
  try {
    output = run('gh release list --exclude-drafts --exclude-pre-releases --limit 1 --json tagName');
  } catch {
    error('failed to fetch releases from GitHub. Ensure gh CLI is authenticated.');
  }

  const releases = JSON.parse(output) as { tagName: string }[];
  if (releases.length === 0) {
    error('no stable releases found. Create an initial release first.');
  }

  const tag = releases[0]!.tagName;
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    error(`unexpected release tag format: '${tag}'. Expected vX.Y.Z`);
  }

  return tag.slice(1);
}

main();
