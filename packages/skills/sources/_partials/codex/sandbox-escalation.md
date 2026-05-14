## Running this from Codex

`contextbridge open` launches a local browser window, which is blocked by Codex's default sandbox. When invoking it, set `sandbox_permissions: "require_escalated"` and supply a brief `justification` (e.g., "Open a local browser so the user can annotate this file"). If the user runs `contextbridge open` regularly, suggest `prefix_rule: ["contextbridge", "open"]` so future invocations don't require re-approval.
