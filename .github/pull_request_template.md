<!--
PR title: conventional commit style (e.g., "feat: add webhook retry logic", "fix: handle null repo owner"). Do NOT include the ticket/issue ID in the title.

Choose the prefix deliberately based on whether this change should appear in the user-facing changelog. See `release-please-config.json`:
  - Visible (appear in CHANGELOG.md): feat, fix, perf, deps, revert
  - Hidden (excluded from CHANGELOG.md): docs, chore, style, refactor, test, build, ci

If the change is internal-only — e.g., an agent prompt tweak, a CI fix, a refactor with no user-visible behavior — use a hidden prefix (typically `chore:`) so it does not pollute the release notes. `fix:` is for bugs users could have hit; an internal-only fix is a `chore:`.
-->

## Summary

<!-- 2-3 sentences explaining what changed and why. Write for a human reviewer, not a changelog parser. Include any related issue references here (e.g., "Closes #123", "ENG-456") — not in the title, not in a separate section. -->

## Review focus

<!-- One or two things you genuinely want a reviewer to think hard about — a risky decision, a trade-off, an API choice that could have gone another way. NOT a list of every file touched. If nothing is unusual, write "Nothing unusual" or delete this section entirely. -->

## Commits

<!--
Before opening this PR, rewrite history so the commits represent the final reviewable product, not the chronological journey. Squash or reorder churn: "wip", "fix typo", "respond to review", revert-of-revert, hook fixups, formatting passes. Each remaining commit should be a semantically meaningful step a reviewer can step through and understand on its own.

Then list them with clickable links (e.g., - [`abc1234`](url) — did the thing).
-->
