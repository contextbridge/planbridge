# PlanBridge

**[Website](https://plan.contextbridge.ai)** | **[Quickstart](https://plan.contextbridge.ai/quickstart)**

[![CI](https://img.shields.io/github/actions/workflow/status/contextbridge/planbridge/main.yml?branch=main&label=CI)](https://github.com/contextbridge/planbridge/actions/workflows/main.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Review your agent's plan the way you review code.

PlanBridge intercepts your AI coding agent's plan so you can mark up any line and leave precise feedback. The agent adjusts before writing the first line of code. It runs locally, hooks into [Claude Code](https://plan.contextbridge.ai/usage/claude-code/) and [Codex CLI](https://plan.contextbridge.ai/usage/codex/), and sends your plan content nowhere.

[Demo Video]("https://plan.contextbridge.ai/demo/plan-review.webm")

<video playsinline poster="https://plan.contextbridge.ai/demo/plan-review-poster.jpg">
  <source src="https://plan.contextbridge.ai/demo/plan-review.mp4" type="video/webm">
</video>

## Install

```sh
/bin/sh -c "$(curl -fsSL https://downloads.contextbridge.ai/cli/install.sh)"
```

The script uses [Homebrew](https://brew.sh/) when available and falls back to a tarball into `$HOME/.local/bin`. After the binary lands, it runs `contextbridge install` to wire up any supported AI coding harness it finds.

Prefer to install yourself?

```sh
brew install contextbridge/tap/cli
contextbridge install
```

For tarball installs, alpha channel, and flag reference, see [Install](https://plan.contextbridge.ai/install/).

## Quick start

1. Install once. The installer detects your harnesses and adds review hooks.
2. Use your harness as you always do.
3. When your agent produces a plan, your browser opens. Annotate, approve, or request changes. Your decision flows back to the harness.

Full walkthrough: [Quickstart](https://plan.contextbridge.ai/quickstart/).

## Supported harnesses

| Harness                                                         | Hook                             |
| --------------------------------------------------------------- | -------------------------------- |
| [Claude Code](https://plan.contextbridge.ai/usage/claude-code/) | `PermissionRequest:ExitPlanMode` |
| [Codex CLI](https://plan.contextbridge.ai/usage/codex/)         | `Stop`                           |

Using something else (Cursor, Aider, opencode, Gemini CLI, Aether)? Any agent that runs shell commands and parses JSON can pipe a plan to `contextbridge plan` and act on the response. See [Other agents](https://plan.contextbridge.ai/usage/other-agents/).

## Privacy

Your plan content stays on your machine. No remote backend, no account, no API keys. The CLI sends anonymous product analytics and crash reports unless you opt out with `DO_NOT_TRACK=1` or `CONTEXTBRIDGE_TELEMETRY_DISABLED=1`. Details: [Privacy & Telemetry](https://plan.contextbridge.ai/privacy/).

## Documentation

- [Quickstart](https://plan.contextbridge.ai/quickstart/)
- [Install](https://plan.contextbridge.ai/install/)
- [How it works](https://plan.contextbridge.ai/how-it-works/)
- [Usage: Claude Code](https://plan.contextbridge.ai/usage/claude-code/)
- [Usage: Codex CLI](https://plan.contextbridge.ai/usage/codex/)
- [Usage: Other agents](https://plan.contextbridge.ai/usage/other-agents/)
- [Privacy & Telemetry](https://plan.contextbridge.ai/privacy/)

## Community

- Slack: [Join the ContextBridge community](https://go.contextbridge.ai/join-community)
- Email: [support@contextbridge.ai](mailto:support@contextbridge.ai?subject=PlanBridge)
- Issues: [GitHub Issues](https://github.com/contextbridge/planbridge/issues)

## Contributing

PRs and issues welcome. Local setup, the development loop, and the release process live in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
