# Bun-native APIs

This monorepo runs on Bun. In code that's only ever executed by Bun — the `contextbridge` binary, the local HTTP server, codegen and build scripts, the SQLite layer — reach for `Bun.*` globals before the Node equivalent. Training-data bias makes the Node API the default suggestion; this rule lists the cases where the Bun shape is materially shorter or more idiomatic and should win.

The trigger globs above already exclude browser packages (`annotation`, `review`, `website`, `ui`) and isomorphic ones (`context`, `shared`, `instrumentation/browser|shared`). If you find yourself in one of those, treat `Bun.*` as off-limits.

For anything not covered below, the canonical reference is <https://bun.sh/llms-full.txt> — it concatenates Bun's full docs into a single markdown file.

## File system reads

`Bun.file(path).text() / .json() / .bytes()` instead of `readFileSync` + `JSON.parse`. Reads are lazy: no I/O until the accessor is awaited.

```ts
// Good
const content = await Bun.file(argPath).text();
const config = await Bun.file(configPath).json<Config>();

// Avoid
const content = readFileSync(argPath, 'utf8');
const config = JSON.parse(readFileSync(configPath, 'utf8')) as Config;
```

In-repo example: `packages/cli/src/commands/open.ts`.

## File system writes

`Bun.write(path, data)` instead of `writeFileSync`. Auto-creates parent directories, accepts strings, `Bun.file` handles, `ArrayBuffer`, or `Response`.

```ts
// Good
await Bun.write(outPath, rendered);

// Avoid
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, rendered, 'utf8');
```

## Globbing & directory walks

`new Bun.Glob(pattern).scanSync(root)` (or async `scan`) instead of `readdirSync({ recursive: true })` and instead of any hand-rolled recursive `walk()`. The recursive `readdirSync` flag works but doesn't pattern-filter; rolling a walk yourself is the most common Node carry-over and the most consistently corrected one in this repo's PR review.

```ts
// Good
const files = Array.from(new Bun.Glob('**/*.md').scanSync(rootDir)).sort();

// Avoid
function walk(dir: string): string[] {
  /* recursive readdirSync... */
}
const files = walk(rootDir).filter((p) => p.endsWith('.md'));
```

In-repo example: `packages/skills/src/handlebars.ts`.

## Subprocesses

`Bun.spawn` / `Bun.spawnSync` instead of `child_process.spawn` / `exec`. Use `Bun.which` instead of probing `$PATH` manually.

```ts
// Good
const proc = Bun.spawn({ cmd: [bin, ...args], stdout: 'pipe', stderr: 'pipe' });
const stdout = await new Response(proc.stdout).text();
const exitCode = await proc.exited;

// Avoid
const { stdout } = await promisify(execFile)(bin, args);
```

In-repo example: `packages/cli/src/CommandRunnerImpl.ts`.

## HTTP servers

`Bun.serve` instead of Express, Fastify, or `node:http`. New endpoints go on the existing `Bun.serve` instance in `packages/server`.

## SQLite

`bun:sqlite` instead of `better-sqlite3` or `node:sqlite`. The `@contextbridge/storage` package already does this — match its pattern when extending storage.

## Compile-time evaluation

Two related Bun-only import attribute forms; reach for them whenever the value is fixed at bundle time.

- `with { type: 'text' }` to embed a file's contents as a string literal at build. Used in `packages/skills/src/codex.ts` to bake rendered SKILL.md files into the CLI binary.
- `with { type: 'macro' }` to evaluate a function at build time and inline its return value. Right shape for version stamps, fixture generation, build-time enumeration of files, and anything else that's a pure function of the source tree.

If you catch yourself writing a `readFileSync(...)` or a constant lookup at the top of a module to compute something the bundler could compute once, it's a macro.

## What not to use

- `fs.readdirSync(..., { recursive: true })` walks → use `Bun.Glob`.
- Hand-rolled recursive `walk()` helpers → use `Bun.Glob`.
- `child_process.exec` / `execFile` → use `Bun.spawn`.
- `node:http` for new servers → use `Bun.serve`.
- `better-sqlite3` / `node:sqlite` → use `bun:sqlite`.

`readFileSync` and `writeFileSync` are not banned outright — they're fine in a tight synchronous loop where `await` would force a redundant restructure — but `Bun.file` / `Bun.write` should be the default.
