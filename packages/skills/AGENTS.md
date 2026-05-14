# AGENTS.md — @contextbridge/skills

PlanBridge skill sources, per-harness rendering, and drift detection.

## Skill source

A skill is `sources/<name>/SKILL.md` following the [agentskills.io specification](https://agentskills.io/specification):

- Required frontmatter: `name` (kebab-case logical name — `open`, not `planbridge-open`), `description`.
- Optional frontmatter: `license`, `compatibility`, `metadata`, `allowed-tools`. Unknown keys reject.
- Body is harness-neutral prose passed through verbatim. Per-harness divergence happens only in frontmatter (`name`, set via `skillRendering.installName`).

## Rendered outputs

`bun run skills:generate` writes one SKILL.md per skill-renderable harness listed in `@contextbridge/harness`. The output directory is `harness.skillRendering.destDir` (relative to the repo root) and the on-disk skill folder is `harness.skillRendering.installName(<name>)`. Today:

- `harnessIntegrations/claude/skills/<name>/SKILL.md` — read off disk by Claude's plugin marketplace.
- `harnessIntegrations/codex/skills/planbridge-<name>/SKILL.md` — embedded into the CLI binary at build time, written to `~/.agents/skills/planbridge-<name>/SKILL.md` on Codex install.

All files are committed. `bun run skills:check` (wired into `just verify` and the lint CI job) regenerates in-memory and fails on byte-diff.

## Templating

SKILL.md bodies are Handlebars templates. `render()` compiles the body through an isolated Handlebars instance and evaluates it with `{ harness }` as the data context, so templates can branch on the active harness:

    {{#if (eq harness.id "codex")}}
    {{> codex/sandbox-escalation}}
    {{/if}}

Only one helper is registered, `eq` (strict equality). The harness conditional is always written at the call site so a reader of the SKILL.md can see what content is harness-specific without opening each referenced partial.

### Partials

Reusable per-harness snippets live at `packages/skills/sources/_partials/<harnessId>/<topic>.md`. Their on-disk path under `_partials/` minus the `.md` extension is the partial name — `_partials/codex/sandbox-escalation.md` is callable as `{{> codex/sandbox-escalation}}`. `loadAllFrom` skips `_`-prefixed directories so the partials tree is invisible to the skill loader and to the orphan-detection pass in `skills:check`.

Partials emit content directly. Wrap them in a `{{#if (eq harness.id "…")}}` block at the call site. Group multiple partials under a single conditional when they're adjacent.

## Rendering

`render(skill, harness)` in `src/render.ts` takes a parsed `Skill` and a `HarnessDescriptor` from `@contextbridge/harness`. The descriptor's `skillRendering` rules supply `installName(name)` — the frontmatter `name` field in the rendered output. The body is compiled as a Handlebars template (see `## Templating`).

## Adding a skill

1. Write `sources/<name>/SKILL.md`.
2. Add an import + body to the array in `src/codex.ts` (the registry the CLI embeds for Codex install). `installId` is derived from the body's frontmatter.
3. `bun run skills:generate`.
4. `bun run skills:check && bun run --cwd packages/cli test`.
5. Commit `sources/`, every `harnessIntegrations/<id>/skills/...`, and the `codex.ts` change together.

## Adding a new harness

Defined in `@contextbridge/harness` — see that package's `AGENTS.md`. Once a descriptor's `skillRendering` is set, this package picks it up automatically; no edits here.
