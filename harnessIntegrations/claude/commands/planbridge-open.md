---
description: Open a markdown file, document, or piece of content in the PlanBridge browser UI for human annotation. Use when the user wants to give human feedback on a file, draft, plan, spec, or any markdown content.
---

# Open content in PlanBridge

Opens a markdown file or piped content in the PlanBridge browser UI, where the user can leave inline annotations and general comments. Their feedback is returned on stdout.

## When to use

Use this PlanBridge action when the user wants to annotate something themselves in the browser. Typical triggers:

- "I want to annotate this in PlanBridge"
- "Open this in the browser so I can mark it up"
- "Let me leave comments on this before you continue"
- The user asks you to revise based on their annotations and you haven't collected them yet

## How to invoke

The CLI takes a file path or stdin content:

    # A path on disk (most common)
    contextbridge open /absolute/path/to/file.md

    # Piped content (when the content lives in conversation, not on disk)
    printf %s "<content>" | contextbridge open

### Resolving the argument

The user's argument may be a literal path or a human-language description. Resolve it first:

1. If it looks like a path and the file exists, use it directly.
2. If it's a description (e.g., "the plan we discussed", "the spec for X"), use your normal file-discovery tools to locate the file in the working directory or recent conversation, then call `contextbridge open <resolved-path>`.
3. If the content lives in conversation rather than on disk (e.g., the user wants to annotate something you just wrote), pipe it via stdin.

If you can't resolve the argument confidently, ask the user for clarification before running anything.

## What happens

1. PlanBridge starts a local browser session and prints the URL.
2. The user annotates in the browser. Block on the CLI until they submit.
3. The CLI prints a markdown summary of the user's feedback to stdout.

## What to do with the output

The output is feedback for discussion, not a directive. Read it carefully:

- If the user left no annotations, acknowledge briefly and continue with whatever they were doing.
- If the user left annotations, respond conversationally. They may want edits, may want discussion, may be flagging things for later. Don't assume edits are required unless the comments make that clear. When in doubt, ask what they want to do next.

Treat the comments the way you'd treat a colleague's review notes — context for the next step, not a checklist to silently execute.

## Limitations

Folders, URLs, and multi-file annotation are not currently supported. Pass a single file path or pipe a single document.
