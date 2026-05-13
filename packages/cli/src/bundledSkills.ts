// Skill assets embedded into the CLI binary at build time. The Codex installer
// writes each entry to disk under `~/.agents/skills/planbridge-<name>/SKILL.md`;
// the Claude side ships plugin assets at
// `harnessIntegrations/claude/skills/<name>/SKILL.md`. A sync test
// (`bundledSkills.test.ts`) asserts Codex bodies only rewrite the skill name.
//
// To add a new skill: drop `harnessIntegrations/claude/skills/<name>/SKILL.md`
// in place, then add a single line to the `bundledSkills` array below — the
// Codex installer iterates over this registry and writes each one.
import openSkill from '../../../harnessIntegrations/claude/skills/open/SKILL.md' with { type: 'text' };

export interface BundledSkill {
  /** Harness skill directory name. Becomes `planbridge-<name>` on Codex install. */
  readonly name: string;
  /** SKILL.md content embedded at build time. */
  readonly body: string;
}

export const bundledSkills: readonly BundledSkill[] = [{ name: 'open', body: toCodexSkill('open', openSkill) }];

/**
 * Claude displays plugin skills with the plugin namespace (`/planbridge:open`),
 * but Codex displays the skill's frontmatter name directly (`$planbridge-open`).
 */
function toCodexSkill(name: string, body: string): string {
  return body.replace(`name: ${name}`, `name: planbridge-${name}`);
}
