---
paths:
  - "packages/skills/sources/**/SKILL.md"
  - "packages/skills/src/codex.ts"
  - "packages/skills/src/outputs/**/*.ts"
  - "packages/harness/src/registry.ts"
  - "harnessIntegrations/claude/commands/**/*.md"
  - "harnessIntegrations/codex/skills/**/SKILL.md"
---

# Adding a PlanBridge skill or command

A source is `packages/skills/sources/<name>/SKILL.md` following the [agentskills.io specification](https://agentskills.io/specification). Use the public installed action name as `<name>`. For the manual open action, that is `planbridge-open`.

`bun run skills:generate` renders committed outputs through `packages/skills/src/outputs/`:

- Standard Agent Skill outputs use `SkillHarnessOutput` for harnesses in `SKILL_RENDERABLE_HARNESSES` (today: `harnessIntegrations/codex/skills/<name>/SKILL.md`).
- Claude's manual action uses `ClaudeCommandOutput`, which writes flat command files to `harnessIntegrations/claude/commands/<name>.md`.

Generated files are drift-checked by `bun run skills:check`.

Edit `packages/skills/sources/<name>/SKILL.md`. Files under `harnessIntegrations/` are generated.

## Steps

1. Write `packages/skills/sources/<name>/SKILL.md`. Frontmatter: required `name` (kebab-case public action name) and `description`. The body is a Handlebars template evaluated with `{ harness }` as context; wrap any harness-specific content (e.g. Codex sandbox guidance) in `{{#if (eq harness.id "…")}}…{{/if}}` and pull in reusable partials from `sources/_partials/<harnessId>/<topic>.md` via `{{> …}}` inside the conditional.
2. If Codex should embed the skill, add an import + entry in `packages/skills/src/codex.ts`:

   ```typescript
   import newSkill from '../../../harnessIntegrations/codex/skills/<name>/SKILL.md' with { type: 'text' };
   // ...
   { installId: '<name>', body: newSkill },
   ```

3. `bun run skills:generate`.
4. `bun run skills:check && bun run --cwd packages/cli test CodexInstaller`.
5. Commit source + every rendered output + the `codex.ts` change together.

If the action needs a new CLI subcommand, add it under `packages/cli/src/commands/` and register in `commands/index.ts`.

## Invocation surfaces

- Claude manual command: `/<name>`, e.g. `/planbridge-open`.
- Codex skill: `$<name>`, e.g. `$planbridge-open`, installed to `~/.agents/skills/<name>/SKILL.md`.

## Adding a new harness

Skill rendering iterates `SKILL_RENDERABLE_HARNESSES` from `@contextbridge/harness`. To add another agentskills.io-compliant harness:

1. In `packages/harness/src/types.ts`, widen `HarnessId` with the new id.
2. In `packages/harness/src/registry.ts`, append an entry to `HARNESSES`. Set `skillRendering` with `installName` and `destDir` (relative to repo root; the path under `harnessIntegrations/<id>/skills` is the convention). Set `installUrl` if the CLI installs into this harness.
3. `bun run skills:generate` picks up the new entry through `SkillHarnessOutput`.
4. If the harness is installable, add a `<X>Installer` extending `ScopedHarnessInstaller` and register it in `packages/cli/src/harnesses/installers.ts`. If it has a hook surface, add `packages/cli/src/commands/hook<X>.ts` and register it in `commands/index.ts`.

Keep non-skill output surfaces in a concrete output class. Do not add generic command metadata to `@contextbridge/harness` until more than one harness actually needs it.
