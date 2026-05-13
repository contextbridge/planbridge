# @contextbridge/storage

Storage owns local-only SQLite connections, Drizzle schema, migrations, and storage test helpers.

- Keep one Drizzle table per `src/db/schema/` file and export explicitly from `schema/index.ts`; do not use `export *` barrels.
- Use generated Drizzle migrations only. Do not manually edit files under `generated/`; update schema and rerun `bun run --cwd packages/storage db:generate -- --name <migration_name>` instead.
- Use real temporary SQLite databases in tests. Do not create in-memory service fakes that reimplement database semantics.
- Storage services must be constructor-injected and use explicit select projections.
- Timestamps are ISO instant strings provided by injected clocks; do not use `Date` for business timestamps.
