import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BaseContext, Logger } from '@contextbridge/context';
import { SKILL_RENDERABLE_HARNESSES } from '@contextbridge/harness';
import { loadAllFrom } from '#src/skills.ts';
import { createScriptContext } from './context.ts';
import { type RenderTarget, SOURCES_DIR, outDirFor, targetsForAll } from './renderTargets.ts';

async function main(ctx: BaseContext): Promise<void> {
  const { logger } = ctx;
  SKILL_RENDERABLE_HARNESSES.forEach((harness) => rmSync(outDirFor(harness), { recursive: true, force: true }));
  const skills = loadAllFrom(SOURCES_DIR);
  const targetResult = await targetsForAll(skills);
  if (targetResult.isErr()) {
    logger.error(targetResult.error.message);
    process.exit(1);
  }
  targetResult.value.forEach((target) => writeTarget(logger, target));
}

function writeTarget(logger: Logger, { path, body }: RenderTarget): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  logger.info(`wrote ${path}`);
}

await main(createScriptContext());
