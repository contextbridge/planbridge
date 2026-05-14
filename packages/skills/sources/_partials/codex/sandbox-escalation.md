## Running this from Codex

This skill runs commands that require resources outside Codex's default sandbox. When invoking them, set `sandbox_permissions: "require_escalated"` and supply a brief `justification` describing what the command does. If the user runs the command regularly, suggest a matching `prefix_rule` (e.g., `["contextbridge", "<subcommand>"]`) so future invocations don't require re-approval.
