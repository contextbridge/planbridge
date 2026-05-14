# AGENTS.md — @contextbridge/harness

The single source of truth for which agent harnesses PlanBridge knows about and what they look like.

## What lives here

- `HarnessId` — the closed union of harness identifiers.
- `HarnessDescriptor` — runtime identity: `id`, `displayName`, `binaryName`, optional `installUrl`, optional `skillRendering` rules.
- `HARNESSES` — the canonical registry, one entry per `HarnessId`.
- Derived views: `INSTALLABLE_HARNESSES` (entries with `installUrl`), `SKILL_RENDERABLE_HARNESSES` (entries with `skillRendering`), plus type-narrowed lookup helpers.

## Adding a new harness

Append one entry to `HARNESSES` in `src/registry.ts` after widening `HarnessId` in `src/types.ts`. Set `installUrl` if PlanBridge can install itself into the harness, and `skillRendering` if the harness consumes agentskills.io-style SKILL.md content. Skills regeneration (`bun run skills:generate`) picks up the new entry without further edits.

If the new harness is installable, `@contextbridge/cli` also needs an installer and (optionally) a hook command — see `packages/cli/AGENTS.md`.

## Conventions

- This package is a leaf — no internal workspace deps. Both `@contextbridge/skills` and `@contextbridge/cli` import from here.
- Descriptors hold *data* (and trivial render functions). Anything that needs `CliContext`, filesystem, or commander belongs in `@contextbridge/cli`.
