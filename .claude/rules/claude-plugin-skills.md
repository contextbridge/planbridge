---
paths:
  - "harnessIntegrations/claude/skills/**/SKILL.md"
  - "packages/cli/src/bundledSkills.ts"
---

# Adding a Claude-plugin skill

Claude-plugin skills auto-distribute to Codex via `packages/cli/src/bundledSkills.ts`. The Claude file is the single source of truth; `CodexInstaller` iterates the registry — no installer changes per skill.

## Steps

1. Create `harnessIntegrations/claude/skills/<name>/SKILL.md` with standard frontmatter (`name`, `description`) and a harness-agnostic body. Don't hardcode `/planbridge:` or `$planbridge-` prefixes in the body — the harness routes invocation before the SKILL.md loads.
2. In `packages/cli/src/bundledSkills.ts`, add an import and one `{ name, body }` entry to the `bundledSkills` array.
3. Run `bun run --cwd packages/cli test bundledSkills` — the per-skill sync test picks up the new entry automatically.

If the skill needs a new CLI subcommand, add it under `packages/cli/src/commands/` and register in `commands/index.ts`.

## Invocation surfaces

- Claude: `/planbridge:<name>`
- Codex: `$planbridge-<name>` (installed to `~/.agents/skills/planbridge-<name>/SKILL.md`)
