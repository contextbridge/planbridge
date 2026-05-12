// Skill assets embedded into the CLI binary at build time. The Codex installer
// writes each entry to disk under `~/.agents/skills/planbridge-<name>/SKILL.md`;
// the Claude side ships the same files as plugin assets at
// `harnessIntegrations/claude/skills/<name>/SKILL.md`. A sync test
// (`bundledSkills.test.ts`) asserts each embedded copy stays in lockstep with
// its on-disk Claude source.
//
// To add a new skill: drop `harnessIntegrations/claude/skills/<name>/SKILL.md`
// in place, then add a single line to the `bundledSkills` array below — the
// Codex installer iterates over this registry and writes each one.
import openSkill from '../../../harnessIntegrations/claude/skills/open/SKILL.md' with { type: 'text' };

export interface BundledSkill {
  /** Directory name under `harnessIntegrations/claude/skills/`. Becomes `planbridge-<name>` on Codex install. */
  readonly name: string;
  /** SKILL.md content embedded at build time. */
  readonly body: string;
}

export const bundledSkills: readonly BundledSkill[] = [{ name: 'open', body: openSkill }];
