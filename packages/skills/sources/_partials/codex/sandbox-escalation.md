## Running this from Codex

In sandboxed Codex environments, this skill usually requires resources outside the default sandbox. When invoking the command, set `sandbox_permissions: "require_escalated"` and supply a brief `justification` describing what the command does. If the user runs the command regularly, suggest a matching `prefix_rule` (e.g., `["contextbridge", "open"]`) so future invocations don't require re-approval.
