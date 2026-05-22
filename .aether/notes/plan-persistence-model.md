---
topic: plan-persistence-model
tags:
  - storage
  - schema
  - plan-review
updated: '2026-05-21'
---

- For plan persistence, model the stable logical plan separately from revision records: `plans` has the stable plan ID; `plan_revisions` represents a single reviewed version/revision with FK to `plans`, stores that revision's content, and will eventually hold comment threads.

- Plan review persistence should not store annotation entrypoint/hook source in SQLite. Keep hook/command source as runtime annotation metadata or analytics only; durable storage should model logical plans and review content/status without `hook_claude`/`hook_codex` provenance columns.

- Plan persistence should expose `PlanRepository` rather than `PlanReviewRepository`; the stable plan row lives in `plans`, individual versions live in SQL table/schema `plan_revisions`, and repository methods generate plan/revision IDs internally.
