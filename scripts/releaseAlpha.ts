#!/usr/bin/env bun
import { execSync } from 'node:child_process';
import semver from 'semver';

const RELEASE_TYPES = ['major', 'minor', 'patch'] as const;
type ReleaseType = (typeof RELEASE_TYPES)[number];

const STABLE_BASELINE = '0.0.0';

function main(): void {
  const increment = process.argv[2];
  if (!increment || !RELEASE_TYPES.includes(increment as ReleaseType)) {
    error('usage: releaseAlpha.ts <major|minor|patch>');
  }

  if (run('git status --porcelain').length > 0) {
    error('working tree is not clean. Commit or stash changes first.');
  }

  const currentBranch = run('git branch --show-current');
  if (currentBranch !== 'main') {
    error(`must be on 'main' branch (currently on '${currentBranch}')`);
  }

  const releases = fetchReleases();

  const latestStable = findLatestStable(releases);
  console.log(`Latest stable version: ${latestStable ?? '(none — baseline 0.0.0)'}`);

  const target = semver.inc(latestStable ?? STABLE_BASELINE, increment as ReleaseType);
  if (!target) {
    error(`failed to increment version '${latestStable ?? STABLE_BASELINE}'`);
  }

  const latestAlphaForTarget = findLatestAlphaFor(target, releases);
  let newVersion: string;
  if (latestAlphaForTarget) {
    const next = semver.inc(latestAlphaForTarget, 'prerelease', 'alpha');
    if (!next) {
      error(`failed to bump alpha '${latestAlphaForTarget}'`);
    }
    newVersion = next;
  } else {
    newVersion = `${target}-alpha.0`;
  }

  for (const r of releases) {
    const v = r.tagName.replace(/^v/, '');
    if (semver.valid(v) && semver.gte(v, newVersion)) {
      error(
        `computed version ${newVersion} is not greater than existing tag ${r.tagName}. ` + `Use a larger increment.`,
      );
    }
  }

  const newTag = `v${newVersion}`;
  console.log(`New version: ${newVersion}`);

  run(`git tag ${newTag}`);
  run(`git push origin ${newTag}`);
  console.log(`Released ${newTag}`);
}

type Release = { tagName: string; isPrerelease: boolean };

function fetchReleases(): Release[] {
  let output: string;
  try {
    output = run('gh release list --limit 100 --json tagName,isPrerelease');
  } catch {
    error('failed to fetch releases from GitHub. Ensure gh CLI is authenticated.');
  }
  return JSON.parse(output) as Release[];
}

function findLatestStable(releases: Release[]): string | null {
  const stables = releases
    .filter((r) => !r.isPrerelease && /^v\d+\.\d+\.\d+$/.test(r.tagName))
    .map((r) => r.tagName.slice(1))
    .sort(semver.rcompare);
  return stables[0] ?? null;
}

function findLatestAlphaFor(target: string, releases: Release[]): string | null {
  const prefix = `v${target}-alpha.`;
  const matches = releases
    .filter((r) => r.tagName.startsWith(prefix) && semver.valid(r.tagName.slice(1)))
    .map((r) => r.tagName.slice(1))
    .sort(semver.rcompare);
  return matches[0] ?? null;
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

main();
