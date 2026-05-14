import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SKILL_RENDERABLE_HARNESSES } from '@contextbridge/harness';
import { loadAllFrom } from '#src/skills.ts';
import { type RenderTarget, SOURCES_DIR, outDirFor, targetsForAll } from './renderTargets.ts';

async function main(): Promise<void> {
  SKILL_RENDERABLE_HARNESSES.forEach((harness) => rmSync(outDirFor(harness), { recursive: true, force: true }));
  const skills = loadAllFrom(SOURCES_DIR);
  const targetResult = await targetsForAll(skills);
  if (targetResult.isErr()) {
    console.error(targetResult.error.message);
    process.exit(1);
  }
  targetResult.value.forEach(writeTarget);
}

function writeTarget({ path, body }: RenderTarget): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  console.log(`wrote ${path}`);
}

await main();
