import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { BaseContext } from '@contextbridge/context';
import { Result, err, fromThrowable, ok } from 'neverthrow';
import type { RenderTarget } from '#src/outputs/GeneratedOutput.ts';
import { GENERATED_OUTPUTS, targetsForAll } from '#src/outputs/generatedOutputs.ts';
import { REPO_ROOT, SOURCES_DIR } from '#src/outputs/paths.ts';
import { loadAllFrom } from '#src/skills.ts';
import { createScriptContext } from './context.ts';

const safeReadFile = fromThrowable((path: string) => readFileSync(path, 'utf8'));

async function main(ctx: BaseContext): Promise<void> {
  const { logger } = ctx;
  const skills = loadAllFrom(SOURCES_DIR);
  const targetResult = await targetsForAll(skills);
  if (targetResult.isErr()) {
    logger.error(targetResult.error.message);
    process.exit(1);
  }
  const targets = targetResult.value;
  const expectedPaths = new Set(targets.map((target) => target.path));

  const driftErrors = Result.combineWithAllErrors(targets.map(checkDrift)).match(
    () => [],
    (errs) => errs,
  );
  const orphanErrors = GENERATED_OUTPUTS.flatMap((output) =>
    output.findOrphans(expectedPaths).map((path) => `orphan: ${relative(REPO_ROOT, path)} has no canonical source`),
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

await main(createScriptContext());
