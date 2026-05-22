# Staff Review Follow-Up Plan for Plan Persistence Changes

## Overview

The current non-markdown changes add local SQLite persistence for plan reviews, wire `@contextbridge/storage` into the CLI, and surface a PlanBridge plan ID in changes-requested feedback. Targeted storage and CLI tests pass locally, and the overall direction matches the stored project convention: keep a stable `plans` row and one `plan_revisions` row per reviewed version.

Staff review found a few issues to address before merge:

1. **Migration tracking is fragile:** the new generated Drizzle migration directory is currently ignored by `.gitignore`, so a fresh checkout/CI run can miss the `plans` and `plan_revisions` tables even though local tests pass.
2. **Database invariants need to live in SQLite, not only repository code:** `plan_revisions.sequence` is queried as if it is unique per plan but the schema only has a non-unique index.
3. **CLI persistence tests duplicate raw SQLite inspection helpers:** `hookClaude.test.ts`, `hookCodex.test.ts`, and `plan.test.ts` each carry variations of `extractPlanId()`, `loadPersistedPlan()`, and raw SQL row loading.
4. **Storage tests can be more idiomatic:** follow the existing project/cb-bot pattern of Fishery factories plus real, temporary databases; reduce repeated Result unwrapping boilerplate.
5. **Revision support should be explicit:** keep the plan/revision schema, but do not add brittle harness transcript parsing in this cleanup. Treat wiring future submissions to an existing plan ID as a follow-up unless product explicitly needs it in this PR.

Success criteria:

- A fresh clone with only tracked files can run storage migrations and create `plans` / `plan_revisions` tables.
- SQLite enforces one revision sequence per plan.
- CLI tests continue using a real temporary SQLite database, but shared helpers remove duplicated raw SQL and plan-ID parsing.
- Storage repository tests use Fishery factories and concise Result assertions while still exercising real SQLite.
- Existing CLI stdout contracts remain unchanged.
- `bun run --cwd packages/storage db:check`, targeted tests, and finally `just verify` pass.

## Technical Approach

- **Keep the two-table persistence model.** Prior project notes say `plans` is the stable logical plan and `plan_revisions` stores reviewed versions. Do not collapse to a single table.
- **Make generated migrations visible and committed.** `cb-bot` keeps generated Drizzle migrations under version control. In this repo, remove the `.gitignore` footgun for `packages/storage/generated/` and rely on `packages/storage/.gitattributes` to suppress noisy snapshot diffs.
- **Enforce invariants with Drizzle schema + generated migrations.** Replace the current non-unique `idx_plan_revisions_plan_sequence` with a unique index/constraint on `(plan_id, sequence)`. Keep explicit select projections in repository reads.
- **Use real SQLite in tests.** Do not introduce `FakePlanRepository` or fake SQLite behavior. Adapt the cb-bot test-helper approach by centralizing database assertions and fixture factories while still using `createDb()`/`withDb()`.
- **DRY helper logic at package boundaries.** Put command-test-only helpers in `packages/cli/src/testHelpers/planPersistence.ts`; put storage test factories/assertion helpers under `packages/storage/src/testHelpers/`.
- **Leave revision reattachment as a follow-up.** The repository can expose `createRevision()`, but current command/hook flows do not receive a trustworthy existing plan ID yet. Avoid adding regex parsing of Claude/Codex transcripts in this cleanup unless requested separately.

## Implementation Steps

1. **Fix migration tracking and drift visibility.**
   - Modify `/home/josh/code/planbridge/.gitignore` to stop ignoring `packages/storage/generated/`.
   - Replace the existing comment with something like:
     ```gitignore
     # Drizzle migrations are committed. .gitattributes marks generated snapshots
     # as generated and suppresses noisy diffs.
     ```
   - Ensure these currently ignored files become normal untracked files and are added in the implementation PR:
     - `packages/storage/generated/drizzle/20260521213130_plans_and_plan_revisions/migration.sql`
     - `packages/storage/generated/drizzle/20260521213130_plans_and_plan_revisions/snapshot.json`
   - Run `bun run --cwd packages/storage db:check` after schema edits below; regenerate with `bun run --cwd packages/storage db:generate -- --name plans_and_plan_revisions` if drift is reported.

2. **Strengthen the `plan_revisions` schema invariant.**
   - In `packages/storage/src/db/schema/planRevisions.ts`, change the table callback from a non-unique index to a unique index:

     ```ts
     import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

     // ...
     (table) => [
       uniqueIndex('uq_plan_revisions_plan_sequence').on(table.planId, table.sequence),
       index('idx_plan_revisions_plan_id').on(table.planId),
     ];
     ```

   - If Drizzle treats the unique index as sufficient for plan-scoped lookups, it is acceptable to omit the separate `idx_plan_revisions_plan_id`; prefer whichever generated SQL is simplest while still supporting `where plan_id order by sequence` efficiently.
   - Regenerate the migration. Do not hand-edit files under `packages/storage/generated/`.
   - Update `packages/storage/src/db/schema/planRevisions.ts` imports accordingly.

3. **Optionally remove status-value drift.**
   - If this stays small, define a shared runtime status tuple in `packages/shared/src/annotationSchema.ts`:
     ```ts
     export const ANNOTATION_STATUS_VALUES = ['approved', 'changes_requested'] as const;
     export const AnnotationStatusSchema = z.enum(ANNOTATION_STATUS_VALUES);
     ```
   - Then import `ANNOTATION_STATUS_VALUES` in `packages/storage/src/db/schema/plans.ts` and use it for Drizzle enum metadata instead of maintaining `PLAN_STATUS_VALUES` separately.
   - Keep this as a small DRY cleanup only; do not expand shared/schema changes beyond this tuple.

4. **Add storage test factories for plan repository inputs.**
   - In `packages/storage/src/testHelpers/factories/db.ts`, add Fishery factories:

     ```ts
     import type { CreateInitialPlanInput, CreatePlanRevisionInput } from '#src/PlanRepositoryImpl.ts';

     export const initialPlanInput = Factory.define<CreateInitialPlanInput>(() => ({
       projectRoot: '/work/project',
       content: '# Plan\n\nStep 1.',
       sourcePath: '/work/project/plan.md',
       status: 'changes_requested',
     }));

     export const planRevisionInput = Factory.define<CreatePlanRevisionInput>(() => ({
       planId: 'plan_placeholder',
       content: '# Revised plan',
       sourcePath: '/work/project/revised.md',
       status: 'approved',
     }));
     ```

   - Export them from `packages/storage/src/testHelpers/index.ts`.
   - Use `.build()` in `PlanRepositoryImpl.test.ts` instead of repeating inline input literals.

5. **Add small Result assertion helpers for storage tests.**
   - In `packages/storage/src/testHelpers/helpers/result.ts`, add:

     ```ts
     import { expect } from 'bun:test';
     import type { Result } from 'neverthrow';

     export function expectOk<T, E>(result: Result<T, E>): T {
       expect(result.isOk()).toBe(true);
       if (result.isErr()) throw result.error;
       return result.value;
     }
     ```

   - Export it from `packages/storage/src/testHelpers/index.ts`.
   - Replace repeated `expect(result.isOk()).toBe(true); if (result.isErr()) throw result.error;` blocks in `PlanRepositoryImpl.test.ts`.

6. **Improve repository tests for database-enforced behavior.**
   - Update `packages/storage/src/PlanRepositoryImpl.test.ts` to use the factories and `expectOk()` helper.
   - Add/adjust tests:
     - `createInitialPlan` stores `createdAt`/`updatedAt` from the injected clock. This verifies the repository, not schema defaults, owns business timestamps.
     - Directly inserting a duplicate `(plan_id, sequence)` fails with a SQLite constraint error. This proves the schema invariant is database-enforced.
     - Cascading delete removes revisions when a plan is deleted, using real SQLite.
   - Keep helpers at the bottom of the file.

7. **Centralize CLI plan persistence test helpers.**
   - Create `packages/cli/src/testHelpers/planPersistence.ts` with shared helpers currently duplicated across command tests:

     ```ts
     import type { PlanRepository, PlanSnapshot } from '@contextbridge/storage';
     import { Database } from 'bun:sqlite';
     import { expect } from 'bun:test';

     const PLAN_ID_PATTERN = /PlanBridge Plan ID: `(plan_[0-9a-f-]+)`/;

     export interface PersistedReviewRow {
       readonly planId: string;
       readonly projectRoot: string;
       readonly content: string;
       readonly status: string;
     }

     export function extractPlanId(output: string): string {
       const match = output.match(PLAN_ID_PATTERN);
       expect(match).not.toBeNull();
       return match![1]!;
     }

     export function loadPersistedPlan(planRepository: PlanRepository, planId: string): PlanSnapshot {
       const result = planRepository.getPlan(planId);
       if (result.isErr()) throw result.error;
       if (!result.value) throw new Error(`Expected persisted plan ${planId}`);
       return result.value;
     }

     export function loadOnlyPersistedReview(dbPath: string): PersistedReviewRow {
       const db = new Database(dbPath, { readonly: true });
       try {
         const rows = db.query(/* same select as today, but use .all() */).all() as PersistedReviewRow[];
         expect(rows).toHaveLength(1);
         return rows[0]!;
       } finally {
         db.close(false);
       }
     }
     ```

   - Export these helpers from `packages/cli/src/testHelpers/index.ts`.
   - Replace duplicated local helper definitions in:
     - `packages/cli/src/commands/plan.test.ts`
     - `packages/cli/src/commands/hookClaude.test.ts`
     - `packages/cli/src/commands/hookCodex.test.ts`
   - Remove direct `bun:sqlite` imports and duplicated `PlanRepository` / `PlanSnapshot` type imports from command tests where the new helper hides them.

8. **Tighten CLI stub-context database lifecycle.**
   - In `packages/cli/src/testHelpers/createStubContext.ts`, keep using a real temp SQLite database.
   - Add enough cleanup surface to avoid temp DB leaks without complicating every existing test:
     ```ts
     export interface TestContext {
       // existing fields...
       readonly cleanup: () => void;
     }
     ```
   - Have `cleanup()` close the storage DB and remove the temp directory. Because existing tests do not currently call cleanup, update only the command tests touched in this PR to call it in `afterEach` if practical. If that produces too much churn, leave cleanup as an available helper and add a follow-up to migrate remaining CLI tests.
   - Do not fake the repository just to avoid cleanup; the real SQLite path is preferred.

9. **Clarify the revision API boundary without wiring transcript parsing.**
   - Keep `PlanRepository.createRevision()` and its tests because the data model intentionally supports revisions.
   - Do not introduce a CLI-level persistence helper for initial plans; command/hook callers can invoke `PlanRepository.createInitialPlan()` directly.
   - Do **not** parse arbitrary Markdown or transcripts for plan IDs in this cleanup; that adds complexity and should be designed deliberately.

10. **Re-run targeted checks, then full verification.**
    - Run:
      ```sh
      bun run --cwd packages/storage db:check
      bun run --cwd packages/storage test
      bun run --cwd packages/cli test hookClaude hookCodex plan
      ```
    - Then run `just verify` and fix any format/typecheck/lint/test failures.

## Testing Plan

### Unit / package tests

- `packages/storage/src/PlanRepositoryImpl.test.ts`
  - Persists initial changes-requested and approved revisions.
  - Creates a second revision with sequence `2`.
  - Returns `null` for unknown plans.
  - Fails for unknown parent plan IDs.
  - Verifies `createdAt`/`updatedAt` use the injected clock.
  - Verifies `(plan_id, sequence)` uniqueness is enforced by SQLite.
  - Verifies cascade delete removes child revisions.

- `packages/storage/src/db/migrate.test.ts`
  - Existing migration count assertion remains.
  - Add explicit assertions that `plans` and `plan_revisions` tables exist after a fresh migration.

- `packages/cli/src/commands/*.test.ts`
  - Existing plan/hook persistence assertions remain behaviorally identical.
  - Tests import shared persistence helpers instead of duplicating local SQL and regex code.
  - Approved paths continue to persist even when stdout has no plan ID.
  - Changes-requested paths still include `PlanBridge Plan ID` in feedback and load the matching persisted plan through the repository.

### Integration checks

- Real temporary SQLite databases through `createDb()` / `withDb()` only.
- No `FakePlanRepository` and no fake SQLite layer.
- `bun run --cwd packages/storage db:check` must pass after schema/migration updates.
- Full `just verify` before completion.

### Edge cases to verify

- Duplicate revision sequence for the same plan fails.
- Same sequence values for different plans are allowed.
- Missing/invalid plan IDs continue to produce repository `StorageError`s rather than silent partial writes.
- CLI command tests fail if more than one review row is persisted when a helper expects exactly one.
- Fresh database migration works from tracked files only.

## Files to Modify/Create

| Path                                                                                       | Change                                                                                                                            | Status         |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `.gitignore`                                                                               | Stop ignoring `packages/storage/generated/`; clarify generated migrations are committed and `.gitattributes` handles noisy diffs. | Modified       |
| `packages/storage/src/db/schema/planRevisions.ts`                                          | Replace non-unique plan/sequence index with unique `(plan_id, sequence)` invariant; keep only necessary supporting indexes.       | Modified       |
| `packages/storage/src/db/schema/plans.ts`                                                  | Optionally consume a shared annotation-status tuple to avoid status-value drift.                                                  | Modified       |
| `packages/shared/src/annotationSchema.ts`                                                  | Optionally export `ANNOTATION_STATUS_VALUES` and build `AnnotationStatusSchema` from it.                                          | Modified       |
| `packages/storage/generated/drizzle/20260521213130_plans_and_plan_revisions/migration.sql` | Regenerate/track generated migration SQL for plan tables and unique sequence invariant.                                           | Added/Modified |
| `packages/storage/generated/drizzle/20260521213130_plans_and_plan_revisions/snapshot.json` | Regenerate/track generated Drizzle snapshot.                                                                                      | Added/Modified |
| `packages/storage/src/testHelpers/factories/db.ts`                                         | Add Fishery factories for initial plan and plan revision repository inputs.                                                       | Modified       |
| `packages/storage/src/testHelpers/helpers/result.ts`                                       | Add `expectOk()` helper for neverthrow Result assertions in storage tests.                                                        | Added          |
| `packages/storage/src/testHelpers/index.ts`                                                | Export new storage factories and Result helper.                                                                                   | Modified       |
| `packages/storage/src/PlanRepositoryImpl.test.ts`                                          | Refactor to factories/helper; add database-invariant tests.                                                                       | Modified       |
| `packages/storage/src/db/migrate.test.ts`                                                  | Assert `plans` and `plan_revisions` exist after fresh migration.                                                                  | Modified       |
| `packages/cli/src/testHelpers/planPersistence.ts`                                          | Add shared plan-ID extraction and real-SQLite persisted-review loading helpers.                                                   | Added          |
| `packages/cli/src/testHelpers/index.ts`                                                    | Export plan persistence test helpers.                                                                                             | Modified       |
| `packages/cli/src/testHelpers/createStubContext.ts`                                        | Add optional cleanup surface for the real temp SQLite database; keep real DB usage.                                               | Modified       |
| `packages/cli/src/commands/plan.test.ts`                                                   | Replace duplicated helper code with shared helper imports; optionally call cleanup.                                               | Modified       |
| `packages/cli/src/commands/hookClaude.test.ts`                                             | Replace duplicated helper code with shared helper imports; remove direct raw SQLite helper.                                       | Modified       |
| `packages/cli/src/commands/hookCodex.test.ts`                                              | Replace duplicated helper code with shared helper imports; remove direct raw SQLite helper.                                       | Modified       |

## Additional Notes

- The review intentionally ignored Markdown changes except for this plan file.
- `~/code/cb-bot` patterns applied here:
  - generated Drizzle migrations are committed;
  - services/repositories are constructor-injected;
  - database tests use real databases and shared helpers, not DB fakes;
  - tests use factories and shared setup helpers to avoid repetitive literals.
- Follow-up task: design how harnesses should attach a revised submission to an existing PlanBridge plan ID. Do this deliberately per harness (Claude transcript, Codex transcript, manual `contextbridge plan` option) instead of adding opportunistic regex parsing in this cleanup.
- Follow-up task: decide whether `approvedPlanRevisionId` should become a database-enforced relationship. A cyclic FK is possible but adds migration/order complexity; defer until approved-revision lookup is used by product code.
