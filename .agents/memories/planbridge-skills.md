# Adding a PlanBridge skill

A skill is `packages/skills/sources/<name>/SKILL.md` following the [agentskills.io specification](https://agentskills.io/specification). `bun run skills:generate` renders it to one SKILL.md per skill-renderable harness in `@contextbridge/harness` (today: `harnessIntegrations/claude/skills/<name>/SKILL.md` and `harnessIntegrations/codex/skills/<name>/SKILL.md`) — all committed, drift-checked by `bun run skills:check`.

Edit `packages/skills/sources/<name>/SKILL.md`. Files under `harnessIntegrations/<id>/skills/` are generated.

## Steps

1. Write `packages/skills/sources/<name>/SKILL.md`. Frontmatter: required `name` (canonical/public kebab-case skill name, for example `planbridge-open`) and `description`. The body is a Handlebars template evaluated with `{ harness }` as context; wrap any harness-specific content (e.g. Codex sandbox guidance) in `{{#if (eq harness.id "…")}}…{{/if}}` and pull in reusable partials from `sources/_partials/<harnessId>/<topic>.md` via `{{> …}}` inside the conditional.
2. Add an import + entry in `packages/skills/src/codex.ts`:

   ```typescript
   import newSkill from '../../../harnessIntegrations/codex/skills/<name>/SKILL.md' with { type: 'text' };
   // ...
   { installId: parseSkill(newSkill).frontmatter.name, body: newSkill },
   ```

3. `bun run skills:generate`.
4. `bun run skills:check && bun run --cwd packages/cli test CodexInstaller`.
5. Commit source + every rendered output + the `codex.ts` change together.

If the skill needs a new CLI subcommand, add it under `packages/cli/src/commands/` and register in `commands/index.ts`.

## Invocation surfaces

- Claude: `/planbridge-open` or `/planbridge:planbridge-open` for the manual open skill, depending on how Claude displays plugin skills.
- Codex: `$planbridge-open` for the manual open skill, installed to `~/.agents/skills/planbridge-open/SKILL.md`.

## Adding a new harness

Skill rendering iterates `SKILL_RENDERABLE_HARNESSES` from `@contextbridge/harness`. To add another agentskills.io-compliant harness:

1. In `packages/harness/src/types.ts`, widen `HarnessId` with the new id.
2. In `packages/harness/src/registry.ts`, append an entry to `HARNESSES`. Set `skillDestDir` to the output directory (relative to repo root; the path under `harnessIntegrations/<id>/skills` is the convention). Set `installUrl` if the CLI installs into this harness.
3. `bun run skills:generate` picks up the new entry — no edits to `packages/skills/`.
4. If the harness is installable, add a `<X>Installer` extending `ScopedHarnessInstaller` and register it in `packages/cli/src/harnesses/installers.ts`. If it has a hook surface, add `packages/cli/src/commands/hook<X>.ts` and register it in `commands/index.ts`.
