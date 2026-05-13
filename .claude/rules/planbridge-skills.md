---
paths:
  - "packages/skills/sources/**/SKILL.md"
  - "packages/skills/src/codex.ts"
  - "packages/harness/src/registry.ts"
  - "harnessIntegrations/claude/skills/**/SKILL.md"
  - "harnessIntegrations/codex/skills/**/SKILL.md"
---

# Adding a PlanBridge skill

A skill is `packages/skills/sources/<name>/SKILL.md` following the [agentskills.io specification](https://agentskills.io/specification). `bun run skills:generate` renders it to one SKILL.md per skill-renderable harness in `@contextbridge/harness` (today: `harnessIntegrations/claude/skills/<name>/SKILL.md` and `harnessIntegrations/codex/skills/planbridge-<name>/SKILL.md`) — all committed, drift-checked by `bun run skills:check`.

Edit `packages/skills/sources/<name>/SKILL.md`. Files under `harnessIntegrations/<id>/skills/` are generated.

## Steps

1. Write `packages/skills/sources/<name>/SKILL.md`. Frontmatter: required `name` (kebab-case logical name — `open`, not `planbridge-open`) and `description`. The body is harness-neutral prose; the harness routes invocation before the SKILL.md loads, so the body rarely needs to name the invocation prefix.
2. Add an import + entry in `packages/skills/src/codex.ts`:

   ```typescript
   import newSkill from '../../../harnessIntegrations/codex/skills/planbridge-<name>/SKILL.md' with { type: 'text' };
   // ...
   { installId: 'planbridge-<name>', body: newSkill },
   ```

3. `bun run skills:generate`.
4. `bun run skills:check && bun run --cwd packages/cli test CodexInstaller`.
5. Commit source + every rendered output + the `codex.ts` change together.

If the skill needs a new CLI subcommand, add it under `packages/cli/src/commands/` and register in `commands/index.ts`.

## Invocation surfaces

- Claude: `/planbridge:<name>` — namespace comes from the plugin manifest.
- Codex: `$planbridge-<name>` — installed to `~/.agents/skills/planbridge-<name>/SKILL.md`.

## Adding a new harness

Skill rendering iterates `SKILL_RENDERABLE_HARNESSES` from `@contextbridge/harness`. To add another agentskills.io-compliant harness:

1. In `packages/harness/src/types.ts`, widen `HarnessId` with the new id.
2. In `packages/harness/src/registry.ts`, append an entry to `HARNESSES`. Set `skillRendering` with `installName` and `destDir` (relative to repo root; the path under `harnessIntegrations/<id>/skills` is the convention). Set `installUrl` if the CLI installs into this harness.
3. `bun run skills:generate` picks up the new entry — no edits to `packages/skills/`.
4. If the harness is installable, add a `<X>Installer` extending `ScopedHarnessInstaller` and register it in `packages/cli/src/harnesses/installers.ts`. If it has a hook surface, add `packages/cli/src/commands/hook<X>.ts` and register it in `commands/index.ts`.
