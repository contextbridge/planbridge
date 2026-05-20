---
name: planbridge-last
description: Open your most recent assistant message in the PlanBridge browser UI for human annotation. Use when the user wants to annotate or give feedback on the wall of text you just wrote.
---

# Annotate your most recent message in PlanBridge

Opens your most recent assistant message in the PlanBridge browser UI, where the user can leave inline annotations and general comments. Their feedback is returned on stdout.

## When to use

Use this skill when the user wants to mark up something you just said. Typical triggers:

- "Let me annotate that"
- "Open the last thing you said in PlanBridge"
- "I want to mark up what you just wrote"
- You just produced a long block of prose, such as a spec, architecture explanation, migration plan, code-review summary, draft commit message, or brainstorming section, and the user wants to give targeted feedback.

## How to invoke

**Do not send any commentary or status message before running the command.** The command targets your most recent rendered message, so a preamble like "Sure, opening that now" can mistakenly become the thing being annotated. Run the command first; speak after.

Copy the immediately previous assistant response from the conversation context and pipe it verbatim into `contextbridge open` via stdin. Preserve all markdown formatting and code blocks. Do not paraphrase, summarize, or rewrite. The user wants to annotate the exact text you produced, not a cleaned-up version.

```sh
contextbridge open <<'PLANBRIDGE_LAST_MESSAGE'
<your immediately previous assistant response, verbatim>
PLANBRIDGE_LAST_MESSAGE
```

{{#if (eq harness.id "codex")}}
{{> codex/sandbox-escalation}}
{{/if}}

Run the command yourself rather than telling the user to invoke shell syntax manually.

If the previous assistant response is no longer available in conversation context, say so and ask the user to provide the content or use `planbridge-open` for a file or specific document.

If `contextbridge` is not available on PATH, report that the PlanBridge CLI is unavailable in the current user environment.

## What happens

1. PlanBridge starts a local browser session and prints the URL.
2. The user annotates in the browser. Block on the CLI until they submit.
3. The CLI prints a markdown summary of the user's feedback to stdout.

## What to do with the output

Treat the comments the way you would treat a colleague's review notes: context for the next step, not a checklist to silently execute.

- If the user left no annotations, acknowledge briefly and continue.
- If the user left annotations, respond conversationally. They may want edits, may want discussion, or may be flagging things for later. When in doubt, ask what they want to do next.

## Limitations

Only your immediately previous assistant response is opened. To annotate a file on disk, an earlier message, or a specific section that is not your prior message, use `planbridge-open` instead.

Very long messages, around 5k+ words, may drift or truncate during verbatim reproduction. For specs and other content of that size, save the content to a file first and use `planbridge-open` against the path.
