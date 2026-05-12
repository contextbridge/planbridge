# AGENTS.md — harness integrations

This directory holds source assets for first-class harness integrations. These files are consumed by external agent harnesses, so keep guidance here generic and let agents inspect the current files for exact hook names, commands, manifest fields, and IDs.

## Maintenance Rules

- Keep integration assets small, declarative, and scoped to the harness directory they belong to.
- Keep each harness' checked-in assets aligned with its installer in `packages/cli/src/harnesses`.
- Install through the harness' public command surface when one exists; avoid copying files directly into user config directories unless that is the harness' supported integration model.
- Treat checked-in harness assets as release artifacts. If a manifest or generated integration file needs version management, wire it through release automation rather than hand-maintaining drift-prone versions.

## Update And Migration Behavior

When a release changes harness contracts, plugin identity, hook shape, or installed assets, the CLI should preserve existing users by refreshing already-managed harness state after the binary update. The refresh should re-run the normal installer for scopes where PlanBridge has installed hook/plugin state and skip harnesses that PlanBridge has never managed.

For renames or migrations, install the new integration successfully before removing legacy state, and only remove legacy state at the same scope being migrated.
