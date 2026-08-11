# Recipes for committed, generated output. All run from the project root.

set working-directory := '..'

# Regenerate AI-tool config (AGENTS.md, CLAUDE.md, .claude/rules, .agents/memories, MCP) from .rulesync/
rulesync:
    bun run rulesync

# Check the checked-in AI-tool config matches .rulesync/ (fails if stale; used in CI)
rulesync-check:
    bun run rulesync:check

# Regenerate harnessIntegrations/ SKILL.md files from packages/skills/sources/
skills:
    bun run skills:generate

# Check the checked-in harness skills match packages/skills/sources/ (fails if stale; used in CI)
skills-check:
    bun run skills:check
