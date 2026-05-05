---
name: open-linear-issue
description: Use when creating Linear issues, filing bugs, opening tickets, or reporting problems found during development. Use for any task that needs tracking in Linear.
---

# Open a Linear Issue

Create issues in the ContextBridge Linear workspace using `mcp__linear__create_issue`.

## Required Parameters (hard-coded)

| Parameter | Value                                  | Notes              |
| --------- | -------------------------------------- | ------------------ |
| `team`    | `CON`                                  | ContextBridge team |
| `project` | `06d395f3-7672-47b2-a64a-ab3072a107da` | ContextBridge CLI project |
| `state`   | `c45bda4b-b3f9-4255-a8e8-7fd36260e24e` | Triage status      |

**Do NOT set `priority`** — leave it unset so it defaults to "No priority." Triage will assign priority.

## Bug Label

If the issue is a bug (crash, incorrect behavior, regression), add the Bug label:

| Parameter | Value                                      |
| --------- | ------------------------------------------ |
| `labels`  | `["5126cd26-b436-4260-9d5d-092711760ddb"]` |

## Writing the Description

Issues must be **self-contained**. A reader must be able to understand the issue without access to the reporter's machine.

- **Include full context**: reproduction steps, log excerpts, screenshots (as attachments), error messages, stack traces.
- **Use Markdown** for formatting — Linear renders it natively.
