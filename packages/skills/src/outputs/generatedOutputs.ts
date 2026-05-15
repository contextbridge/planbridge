import { SKILL_RENDERABLE_HARNESSES } from '@contextbridge/harness';
import { Result, ResultAsync } from 'neverthrow';
import type { Skill } from '#src/skills.ts';
import { ClaudeCommandOutput } from './ClaudeCommandOutput.ts';
import type { GeneratedOutput, RenderTarget } from './GeneratedOutput.ts';
import { SkillHarnessOutput } from './SkillHarnessOutput.ts';

export const GENERATED_OUTPUTS: readonly GeneratedOutput[] = [
  ...SKILL_RENDERABLE_HARNESSES.map((harness) => new SkillHarnessOutput(harness)),
  new ClaudeCommandOutput(),
];

export function targetsForAll(skills: readonly Skill[]): ResultAsync<RenderTarget[], Error> {
  return ResultAsync.fromSafePromise(Promise.all(GENERATED_OUTPUTS.map((output) => output.targetsFor(skills))))
    .andThen((results) => Result.combine(results))
    .map((targets) => targets.flat());
}
