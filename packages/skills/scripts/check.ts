import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { SKILL_RENDERABLE_HARNESSES } from '@contextbridge/harness';
import { Result, err, fromThrowable, ok } from 'neverthrow';
import { loadAllFrom } from '#src/skills.ts';
import { REPO_ROOT, type RenderTarget, SOURCES_DIR, outDirFor, targetsForAll } from './renderTargets.ts';

const safeReadFile = fromThrowable((path: string) => readFileSync(path, 'utf8'));
const safeReaddir = fromThrowable((dir: string) => readdirSync(dir, { withFileTypes: true }));

async function main(): Promise<void> {
  const skills = loadAllFrom(SOURCES_DIR);
  const targetResult = await targetsForAll(skills);
  if (targetResult.isErr()) {
    console.error(targetResult.error.message);
    process.exit(1);
  }
  const targets = targetResult.value;
  const expectedDirs = new Set(targets.map((t) => dirname(t.path)));

  const driftErrors = Result.combineWithAllErrors(targets.map(checkDrift)).match(
    () => [],
    (errs) => errs,
  );
  const orphanErrors = SKILL_RENDERABLE_HARNESSES.flatMap((harness) =>
    findOrphans(outDirFor(harness), expectedDirs).map(
      (dir) => `orphan: ${relative(REPO_ROOT, dir)} has no canonical source`,
    ),
  );

  const errors = [...driftErrors, ...orphanErrors];
  if (errors.length > 0) {
    errors.forEach((e) => console.error(e));
    console.error('\nRun `bun run skills:generate` to regenerate harness outputs from sources.');
    process.exit(1);
  }
  console.log(`✓ ${skills.length} skill(s) in sync with committed outputs.`);
}

function checkDrift({ path, body, harness }: RenderTarget): Result<void, string> {
  return safeReadFile(path)
    .orElse(() => ok(''))
    .andThen((actual) =>
      actual === body
        ? ok(undefined)
        : err(`drift: ${relative(REPO_ROOT, path)} does not match rendered ${harness.id} output`),
    );
}

function findOrphans(parent: string, expectedDirs: Set<string>): string[] {
  return safeReaddir(parent)
    .unwrapOr([])
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parent, entry.name))
    .filter((dir) => !expectedDirs.has(dir));
}

await main();
