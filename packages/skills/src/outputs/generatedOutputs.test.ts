import { describe, expect, it } from 'bun:test';
import { ClaudeCommandOutput } from './ClaudeCommandOutput.ts';
import { GENERATED_OUTPUTS } from './generatedOutputs.ts';
import { SkillHarnessOutput } from './SkillHarnessOutput.ts';

describe('GENERATED_OUTPUTS', () => {
  it('contains Codex skill output and Claude command output', () => {
    expect(GENERATED_OUTPUTS.map((output) => output.id)).toEqual(['codex', 'claude-command']);
    expect(GENERATED_OUTPUTS[0]).toBeInstanceOf(SkillHarnessOutput);
    expect(GENERATED_OUTPUTS[1]).toBeInstanceOf(ClaudeCommandOutput);
  });
});
