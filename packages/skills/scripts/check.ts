import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { BaseContext } from '@contextbridge/context';
import { SKILL_RENDERABLE_HARNESSES } from '@contextbridge/harness';
import { Result, err, fromThrowable, ok } from 'neverthrow';
import { loadAllFrom } from '#src/skills.ts';
import { createScriptContext } from './context.ts';
import { REPO_ROOT, type RenderTarget, SOURCES_DIR, outDirFor, targetsForAll } from './renderTargets.ts';

const safeReadFile = fromThrowable((path: string) => readFileSync(path, 'utf8'));
const safeScan = fromThrowable((pattern: string, root: string) => Array.from(new Bun.Glob(pattern).scanSync(root)));

async function main(ctx: BaseContext): Promise<void> {
  const { logger } = ctx;
  const skills = loadAllFrom(SOURCES_DIR);
  const targetResult = await targetsForAll(skills);
  if (targetResult.isErr()) {
    logger.error(targetResult.error.message);
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
    errors.forEach((e) => logger.error(e));
    logger.error('Run `bun run skills:generate` to regenerate harness outputs from sources.');
    process.exit(1);
  }
  logger.info(`✓ ${skills.length} skill(s) in sync with committed outputs.`);
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
  return safeScan('*/SKILL.md', parent)
    .unwrapOr([])
    .map((relPath) => join(parent, dirname(relPath)))
    .filter((dir) => !expectedDirs.has(dir));
}

await main(createScriptContext());
