import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BaseContext, Logger } from '@contextbridge/context';
import type { RenderTarget } from '#src/outputs/GeneratedOutput.ts';
import { GENERATED_OUTPUTS, targetsForAll } from '#src/outputs/generatedOutputs.ts';
import { SOURCES_DIR } from '#src/outputs/paths.ts';
import { loadAllFrom } from '#src/skills.ts';
import { createScriptContext } from './context.ts';

async function main(ctx: BaseContext): Promise<void> {
  const { logger } = ctx;
  GENERATED_OUTPUTS.forEach((output) => output.clean());
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
