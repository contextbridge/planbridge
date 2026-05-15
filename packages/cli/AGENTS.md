# AGENTS.md — @contextbridge/cli

The `contextbridge` binary. Owns the subcommand dispatch, commander wiring, pino logger, and the annotation-loop orchestration (local HTTP server + browser lifecycle). Root repo conventions still apply — see `../../AGENTS.md` for repo-wide rules (DI, file naming, imports, Context pattern overview).

## Binary & framework

- **Binary name:** `contextbridge`.
- **CLI framework:** commander, with `.exitOverride()` and `.configureOutput()` wired to the injected `ctx.io` so every byte of framework output (help, version, errors) flows through the context — never directly to `process.stdout` / `process.stderr`.
- **Subcommand model:** every feature is a subcommand on the root binary — `contextbridge plan`, `contextbridge review`, etc. Keep the dispatch layer thin so new features slot in as siblings without surgery.

## Logger

pino. Writes JSON to `stderr` by default; switches to pino-pretty (sync stream, not a transport worker) when `stderr` is a TTY. **Transport workers are avoided on purpose — they break under `bun build --compile`.**

Business output (stdout) and diagnostics (logger → stderr) stay on separate channels so piped consumers see clean stdout while humans get readable log output (pretty-printed when interactive).

## Subcommand structure

Each subcommand module exports two things:

1. **`runXxx(ctx, args)`** — the pure handler. Holds the command's logic. Directly unit-testable against a stub context; no framework involvement.
2. **`registerXxx(ctx, program)`** — wires the handler into commander via `program.command(...).action(...)` with `ctx` captured by closure.

## CliContext

Extends `BaseContext` from `@contextbridge/context` and adds:

- **`environment`** — Zod-parsed env vars. **Never read `process.env` directly in handlers.**
- **`io`** — `stdout` / `stderr` / `stdin` streams. Use `io.stdout` for a command's _business output_ — the thing a piped consumer parses.
- **`openUrl`** — platform-appropriate browser launcher.

## Testing

- `createStubContext()` from `#src/testHelpers/index.ts` — build a `CliContext` backed by in-memory streams for unit tests. Call `runXxx(stub, args)` directly; no commander round-trip.
- Log output is captured on a dedicated `MemoryStream` exposed by the test context; `readLogs()` parses pino's JSON lines for assertions.
- For CLI-level tests that need to exercise argv parsing or dispatch, call `runCli(ctx, argv)` from `#src/cli.ts`.

## Annotation Loop

```
stdin / [path]  ─▶  contextbridge plan
                       │
                       ├─ start local Bun HTTP server (ephemeral port)
                       ├─ open browser to http://localhost:<port>
                       └─ block until the browser submits
                                 │
                    ◀─ structured result on stdout:
                       { status: "approved" | "changes_requested", annotations: [...] }
```

The loop is kind-agnostic: it serves a markdown document into the annotation UI and emits a structured result on stdout. Sibling entrypoints on this same loop today: `plan` (plan-mode handoffs from Claude Code and Codex hooks) and `open` (manual annotation of a markdown file or piped content, surfaced as `/planbridge-open` or `/planbridge:planbridge-open` in Claude and `$planbridge-open` in Codex). The CLI process owns the server and the browser lifecycle. When the user submits in the browser, the server shuts down and the CLI emits its structured result to stdout. That stdout contract is what harness hooks (Claude `exitPlanMode`, Codex Stop hook, etc.) consume.

## Build: embedded annotation UI

At build time, the `@contextbridge/annotation` UI is bundled into a single HTML file via `vite-plugin-singlefile` and embedded into the compiled CLI binary as a string literal — see `scripts/build.ts`. The binary is fully self-contained: no external assets at runtime.
