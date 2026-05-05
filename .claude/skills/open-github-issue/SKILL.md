---
name: open-github-issue
description: Use when creating GitHub issues, filing bugs, opening tickets, or reporting problems found during development. Use for any task that needs tracking in GitHub.
---

# Open a GitHub Issue

Create issues in the `contextbridge/planbridge` GitHub repository using the `gh` CLI.

## Command

Pass the body via a HEREDOC so newlines, backticks, and code fences render correctly:

```sh
gh issue create \
  --repo contextbridge/planbridge \
  --title "<title>" \
  --body "$(cat <<'EOF'
<markdown body>
EOF
)"
```

Always pass `--repo contextbridge/planbridge` explicitly so the issue lands in the right repo regardless of the current working directory.

Do **not** assign a milestone, priority, or assignee — leave those unset. Triage will assign them.

## Bug Label

If the issue is a bug (crash, incorrect behavior, regression), add the `bug` label:

```sh
gh issue create --repo contextbridge/planbridge --label bug --title "…" --body "…"
```

For other categories, omit `--label`.

## Writing the Description

Issues must be **self-contained**. A reader must be able to understand the issue without access to the reporter's machine.

- **Include full context**: reproduction steps, log excerpts, error messages, stack traces.
- **Use Markdown** for formatting — GitHub renders it natively.
- After creation, return the issue URL printed by `gh` so the user can open it.
