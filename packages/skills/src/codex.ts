import planbridgeLastSkill from '../../../harnessIntegrations/codex/skills/planbridge-last/SKILL.md' with { type: 'text' };
import planbridgeOpenSkill from '../../../harnessIntegrations/codex/skills/planbridge-open/SKILL.md' with { type: 'text' };
import { parseSkill } from './skills.ts';

export interface BundledSkill {
  /** On-disk install directory name, e.g. `planbridge-open`. Matches `~/.agents/skills/<installId>/`. */
  readonly installId: string;
  /** Pre-rendered Codex SKILL.md content embedded at build time. */
  readonly body: string;
}

export const bundledSkills: readonly BundledSkill[] = [planbridgeOpenSkill, planbridgeLastSkill].map((body) => ({
  installId: parseSkill(body).frontmatter.name,
  body,
}));
