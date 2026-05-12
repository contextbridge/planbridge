---
name: open-github-issue
description: Use when creating GitHub issues, filing bugs, opening tickets, or reporting problems found during development. Use for any task that needs tracking in GitHub.
---

# Open a GitHub Issue

Create issues in the `contextbridge/planbridge` GitHub repository using the `gh` CLI. Every issue must follow the structure of one of the issue form templates under `.github/ISSUE_TEMPLATE/` so agent-filed issues look consistent with human-filed reports and downstream tooling can pattern-match the rendered headings.

## Is this even an issue?

GitHub issues are for bugs, regressions, and feature requests against the codebase. They are **not** for:

- Questions or how-do-I support requests
- Open-ended design discussion
- Anything that doesn't have a clear "this should change" outcome

Route those to the community Slack at https://go.contextbridge.ai/join-community instead. Only proceed below if you're filing a concrete bug or feature request.

## Pick a template

The repo's available templates are the source of truth — don't hard-code assumptions in your head:

```sh
ls .github/ISSUE_TEMPLATE/*.yml
```

Skip `config.yml` (chooser config, not a template). For each remaining file, read its `name:` and `description:` to decide which one matches the issue you're filing. Pick exactly one.

## Pull metadata from the template, not from memory

Once you've picked a template, **read it** and extract:

- **Title prefix** — the `title:` field (e.g., `'bug: '`, `'feat: '`). Include the trailing space exactly as written.
- **Label** — the `labels:` array (e.g., `["bug"]`). Pass each value through `--label` on the `gh` command.
- **Body structure** — the `body:` array, in order. Every entry with an `attributes.label` becomes a `### <label>` heading in your issue body.
- **Required fields** — entries with `validations: required: true` must have substantive content under their heading. Don't skip them.
- **Optional fields** — entries without that validation are optional. Omit the section entirely if you have nothing useful to write; empty placeholders are noise.

For a required field where literal information doesn't apply (e.g., filing a code-quality bug noticed during review, where "Operating system" is irrelevant), write a single short sentence explaining why (e.g., "Not applicable — issue is in source code, observed during code review of commit `<sha>`."). Don't skip required fields silently.

Mirroring the template's headings produces output indistinguishable from a human-submitted form, which is what downstream search and automation expect.

## Command

Pass the body via a HEREDOC so newlines, backticks, and code fences render correctly:

```sh
gh issue create \
  --repo contextbridge/planbridge \
  --label "<label from template>" \
  --title "<prefix from template><your title>" \
  --body "$(cat <<'EOF'
### <First field label from template>

<content>

### <Next field label>

<content>
EOF
)"
```

- Always pass `--repo contextbridge/planbridge` explicitly so the issue lands in the right repo regardless of the current working directory.
- Do **not** assign a milestone, priority, or assignee — leave those unset. Triage will assign them.

## Writing the content

Issues must be **self-contained**. A reader must be able to understand the issue without access to the reporter's machine or session.

- **Include full context** under each section: reproduction steps, log excerpts, error messages, stack traces, file paths and line numbers when relevant.
- Wrap logs, stack traces, and command output in fenced code blocks (` ```shell `).
- Use Markdown for everything else — GitHub renders it natively.
- After creation, return the issue URL printed by `gh` so the user can open it.
