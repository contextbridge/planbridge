# Plan Revision Threaded Agent Comments Implementation Plan

## Overview

### Problem statement

PlanBridge currently treats each `contextbridge plan` invocation as a standalone review. When a user requests changes, the agent receives markdown feedback, revises the plan, and submits another plan through the normal hook/command path. PlanBridge has no durable way to know that the new plan is a revision of an existing review, and the agent has no structured way to respond in the same comment threads or add notes explaining changes in the revised plan.

We will implement explicit revision support using the user-selected Option B:

```sh
contextbridge plan [path] \
  --revision-of <plan-id> \
  --agent-comments <json-or-path>
```

The first review response will give the agent a PlanBridge Plan ID plus stable thread IDs. A revised review must pass that Plan ID and a separate structured JSON value — either inline JSON or a JSON file path — containing agent replies and agent-authored document/inline comments. PlanBridge will persist review state locally, load prior threads for revisions, append canonical agent messages, open the revised plan with full threaded context, and only approve/block based on new user feedback for the current review attempt.

### Success criteria and acceptance conditions

- First `contextbridge plan` reviews still work from stdin or path with no behavior regression.
- When feedback is submitted on a new plan, the agent-facing markdown includes:
  - a stable PlanBridge Plan ID,
  - stable Thread IDs for each actionable comment thread,
  - an example `contextbridge plan --revision-of <plan-id> --agent-comments <json-or-path>` command,
  - the JSON shape expected by `--agent-comments`.
- `contextbridge plan --revision-of <plan-id> --agent-comments <json-or-path> [plan-path]`:
  - validates that the referenced plan exists,
  - validates the agent comments JSON,
  - rejects unknown reply `threadId` values,
  - loads prior threads,
  - appends agent replies to existing threads,
  - adds agent document-level comments as global threads,
  - passes agent inline comments to the browser UI for anchoring against the revised plan.
- The annotation UI renders full thread histories with user and agent messages, not just the first message.
- Historical messages are read-only. Users can add new replies/comments during the current attempt.
- Revision approval is based on **new user-authored feedback in the current attempt**, not on the existence of historical threads or agent comments.
- If the user approves a revised plan, subsequent Claude/Codex hook invocations for the exact approved content hash do not re-open PlanBridge.
- If a hook sees an unapproved active review for the same harness session and the plan content is not approved, it tells the agent to use the explicit revision command instead of silently creating a new unrelated review.
- Storage uses local SQLite via `@contextbridge/storage` with generated Drizzle migrations. Do not manually edit generated migration files.
- All schema additions remain backward-compatible for existing payload/submission JSON.

## Technical Approach

### Architectural decisions

1. **Use explicit revision identity, not inference.**
   PlanBridge will not infer revisions from similar markdown. The `--revision-of <plan-id>` flag is the authoritative signal that the plan is a revision of an existing review.

2. **Use structured JSON input for agent comments.**
   `--agent-comments <json-or-path>` accepts either an inline JSON object string or a path to a JSON file. Treat values whose trimmed first character is `{` as inline JSON; otherwise treat the value as a file path and read it with `Bun.file(path).text()`. Do not support `--agent-comments -` in this iteration because plan content may already come from stdin. The inline form is the preferred quick path for small replies, while file input remains available for larger/safer payloads.

   ```sh
   contextbridge plan revised.md --revision-of plan_abc123 --agent-comments '{"version":1,"replies":[],"comments":[]}'
   ```

3. **PlanBridge owns canonical thread/message metadata.**
   The agent JSON supplies only targets and bodies. PlanBridge creates message IDs, timestamps, author records, and attempt IDs. The agent cannot spoof users, timestamps, or message IDs.

4. **Persist a review-session ledger locally.**
   Add storage tables for plan reviews, attempts, threads, and messages. Store thread subjects as JSON, messages as rows, and validate JSON with shared Zod schemas on load.

5. **Keep DOM-derived anchors inside the browser.**
   Existing `StoredAnnotationAnchor` values depend on rendered markdown, DOM target IDs, text offsets, and source-line attributes. Agent inline comments should provide a required revised markdown source line number plus an optional match string that must be unique within that line. The annotation UI will use the rendered markdown/source-line mapping to resolve those selectors into canonical anchors after the revised markdown is rendered.

6. **Preserve existing Web Annotation-inspired model.**
   Resolved threads should continue storing canonical `CommentThread`, `CommentMessage`, `StoredAnnotationAnchor`, and text position/quote selector data. The line/match selector is only agent input for revisions; it is not persisted as the canonical annotation anchor when resolution succeeds.

7. **Do not let historical feedback block approval.**
   For revisions, `status: 'approved'` means the user added no new user-authored feedback during the current attempt. Prior user comments and agent replies remain visible context but are not automatically “new feedback”.

### Proposed agent comments JSON

Add a shared schema for this input:

```json
{
  "version": 1,
  "replies": [
    {
      "threadId": "thr_annotation_abc123",
      "body": "I reordered the storage and UI steps so the schema is finalized before UI wiring begins."
    }
  ],
  "comments": [
    {
      "kind": "document",
      "body": "I also added explicit rollback and success criteria in this revision."
    },
    {
      "kind": "inline",
      "selector": {
        "line": 18,
        "match": "rollback and success criteria"
      },
      "body": "This new step addresses the requested operational safety detail."
    }
  ]
}
```

Design notes:

- `version` is `1` for future compatibility.
- `replies[]` append agent messages to existing threads.
- `comments[kind=document]` create new global/document-level threads authored by the agent.
- `comments[kind=inline]` are pending inline agent comments. The browser resolves them to annotation anchors after rendering using markdown source line numbers. `selector.line` is required and refers to the revised markdown source file line; `selector.match` is optional but, when present, must uniquely identify text within that source line.
- `body` fields use `.trim().nonempty()`.
- Unknown keys should be rejected with `.strict()` so invalid agent output fails fast.

### Review context payload

Extend `AnnotationPayload` with an optional review context:

```ts
reviewContext?: {
  planId: string;
  attemptId: string;
  mode: 'initial' | 'revision';
  threads: CommentThread[];
  pendingAgentInlineComments: AgentInlineRevisionComment[];
}
```

- `threads` are already canonical `CommentThread` records and include historical messages plus any agent replies/document comments prepared for this revision.
- `pendingAgentInlineComments` are resolved by the annotation UI after `SelectableTextIndex` is available.
- `open`/generic document annotation can omit `reviewContext` and preserve current behavior.

### Storage model

Add one table per `src/db/schema/` file:

- `plan_reviews`
  - `id` text primary key, user-facing `plan_...` ID
  - `project_root` text not null
  - `harness_session_id` text nullable
  - `status` text not null (`changes_requested`, `approved`)
  - `approved_attempt_id` text nullable
  - `approved_content_hash` text nullable
  - timestamps
- `plan_review_attempts`
  - `id` text primary key, `attempt_...`
  - `plan_review_id` FK not null
  - `sequence` integer not null
  - `kind` text not null (`initial`, `revision`)
  - `content_hash` text not null
  - `content` text not null
  - `source_path` text nullable
  - timestamps
- `plan_review_threads`
  - `id` text primary key, existing thread ID
  - `plan_review_id` FK not null
  - `subject_json` text not null, validated as `CommentThreadSubjectSchema`
  - `created_in_attempt_id` text not null
  - timestamps
- `plan_review_messages`
  - `id` text primary key, existing message ID
  - `thread_id` FK not null
  - `plan_review_id` FK not null for efficient lookup
  - `order_index` integer not null
  - `author_json` text not null, validated as `CommentAuthorSchema`
  - `body` text not null
  - `message_created_at` text not null
  - `created_in_attempt_id` text not null
  - timestamps

Use generated Drizzle migrations only:

```sh
bun run --cwd packages/storage db:generate -- --name plan_review_sessions
```

### CLI orchestration

Introduce a plan-review session helper used by `runPlan`, Claude hooks, and Codex hooks. Keep `runAnnotation` focused on browser/server orchestration.

Proposed helper shape:

```ts
export interface RunPlanReviewAttemptArgs {
  content: string;
  entrypoint: AnnotationEntrypoint;
  sourcePath?: string;
  port?: number;
  revisionOf?: string;
  agentComments?: string;
  harnessSessionId?: string;
}

export interface PlanReviewAttemptResult {
  submission: AnnotationSubmission;
  planId: string;
  attemptId: string;
  contentHash: string;
}

export async function runPlanReviewAttempt(
  ctx: CliContext,
  args: RunPlanReviewAttemptArgs,
  deps?: AnnotationDependencies,
): Promise<PlanReviewAttemptResult>;
```

Responsibilities:

1. Generate or load `planId`.
2. Generate a new `attemptId`.
3. Compute a SHA-256 content hash.
4. For revisions, load previous threads from storage and parse/apply agent comments.
5. Call `runAnnotation` with `reviewContext` in the payload.
6. Persist the attempt and resulting full thread ledger after the browser submission.
7. Return the submission plus IDs for formatting/hook decisions.

### Hook behavior

Before opening a review, hooks should query storage by content hash:

- If an approved attempt exists for this `projectRoot` and content hash, approve/no-op immediately.
- Else, if there is an active unapproved review for the same harness session, block with instructions to use `contextbridge plan --revision-of <plan-id> --agent-comments <json-or-path>`.
- Else, open a new initial review as today.

This prevents a user-approved explicit revision from being reviewed again when the agent later triggers the native harness plan-mode exit hook.

## Implementation Steps

1. **Add shared revision schemas.**
   - Modify `packages/shared/src/annotationSchema.ts`.
   - Add:
     - `PlanReviewModeSchema = z.enum(['initial', 'revision'])`.
     - `AgentInlineSelectorSchema` with required `line: z.number().int().positive()` and optional `match: z.string().trim().nonempty()`. The line is a markdown source file line in the revised plan, not a browser visual/soft-wrapped line.
     - `AgentThreadReplySchema`.
     - `AgentRevisionDocumentCommentSchema`.
     - `AgentRevisionInlineCommentSchema`.
     - `AgentRevisionCommentsSchema` with `.strict()` object members and defaults for `replies`/`comments`.
     - `AnnotationReviewContextSchema`.
   - Extend `CommentMessageSchema` with optional `createdInAttemptId: z.string().nonempty().optional()`.
   - Extend `StoredAnnotationAnchorSchema.createdFrom` to include `'agent'`.
   - Extend `AnnotationPayloadSchema` with optional `reviewContext`.
   - Update exported types.
   - Add tests in `packages/shared/src/annotationSchema.test.ts` for valid/invalid agent comments JSON, optional backward compatibility, and `createdFrom: 'agent'`.

2. **Update shared test factories.**
   - Modify `packages/shared/src/testFactories.ts`.
   - Add factories for:
     - `agentAuthor`.
     - `agentCommentMessage`.
     - `agentRevisionComments`.
     - `annotationReviewContext`.
   - Update existing `commentMessage` factory to allow `createdInAttemptId` overrides.

3. **Add storage schema tables.**
   - Add files:
     - `packages/storage/src/db/schema/planReviews.ts`
     - `packages/storage/src/db/schema/planReviewAttempts.ts`
     - `packages/storage/src/db/schema/planReviewThreads.ts`
     - `packages/storage/src/db/schema/planReviewMessages.ts`
   - Export them explicitly from `packages/storage/src/db/schema/index.ts`.
   - Use `timestamps` for all tables.
   - Add indexes:
     - `idx_plan_reviews_project_root_status`
     - `idx_plan_reviews_harness_session_status`
     - `idx_plan_reviews_approved_hash`
     - `idx_plan_review_attempts_review_sequence`
     - `idx_plan_review_threads_review`
     - `idx_plan_review_messages_thread_order`
   - Use SQLite FK references and cascade deletes where supported by Drizzle.
   - Run generated migration command; commit generated files under `packages/storage/generated/drizzle/`.

4. **Implement the plan review repository.**
   - Add `packages/storage/src/PlanReviewRepositoryImpl.ts`.
   - Export a public `PlanReviewRepository` interface and `PlanReviewRepositoryImpl` class.
   - Constructor dependencies:
     ```ts
     interface PlanReviewRepositoryImplOptions {
       dbPath: string;
       clock: () => Temporal.Instant;
     }
     ```
   - Use `createDb({ dbPath })` inside methods and close in `finally`.
   - Use explicit select projections.
   - Parse stored JSON with shared Zod schemas on load.
   - Methods:
     ```ts
     createOrReplaceAttempt(input: PersistPlanReviewAttemptInput): Result<void, StorageError>;
     getReview(planId: string): Result<PlanReviewSnapshot | null, StorageError>;
     findApprovedAttemptByHash(input: { projectRoot: string; contentHash: string }): Result<ApprovedAttempt | null, StorageError>;
     findActiveReviewForHarnessSession(input: { projectRoot: string; harnessSessionId: string }): Result<ActivePlanReview | null, StorageError>;
     ```
   - `createOrReplaceAttempt` should run in one transaction:
     - upsert/insert `plan_reviews`,
     - insert the new attempt,
     - delete existing threads/messages for the review,
     - insert the submitted full thread ledger,
     - set approved fields when status is `approved`.

5. **Add storage repository tests with real SQLite DBs.**
   - Add `packages/storage/src/PlanReviewRepositoryImpl.test.ts`.
   - Use `withDb` or a temp DB path; do not fake database semantics.
   - Cover:
     - persisting and loading an initial review with global/annotation threads,
     - appending a revision attempt and replacing thread ledger,
     - preserving message order,
     - querying approved attempts by content hash,
     - querying active reviews by harness session,
     - rejecting/throwing on invalid stored JSON if manually corrupted.

6. **Wire the repository into `CliContext`.**
   - Modify `packages/cli/src/context.ts`.
   - Add `readonly planReviews: PlanReviewRepository` to `CliContext`.
   - Create the repository in `createContext()` using:
     - `resolveStoragePath({ env })` from `@contextbridge/storage`,
     - `clock: () => Temporal.Now.instant()`.
   - Add `@contextbridge/storage` as a dependency in `packages/cli/package.json`.
   - Add a `FakePlanReviewRepository` test helper in `packages/cli/src/testHelpers/FakePlanReviewRepository.ts` and export it from `testHelpers/index.ts`.
   - Update `createStubContext` to include the fake repository by default.

7. **Implement content hash and ID helpers.**
   - Add `packages/cli/src/planReview/contentHash.ts`:
     ```ts
     export function hashPlanContent(content: string): string;
     ```
     Use Bun-native hashing in CLI-only code, e.g. `Bun.CryptoHasher.hash('sha256', content, 'hex')`.
   - Add `packages/cli/src/planReview/ids.ts`:
     ```ts
     export function createPlanReviewId(): string; // plan_<uuid>
     export function createPlanReviewAttemptId(): string; // attempt_<uuid>
     export function createAgentMessageId(): string; // msg_<uuid>
     export function createAgentThreadId(kind: 'global' | 'annotation'): string;
     ```

8. **Implement agent comments parsing and application.**
   - Add `packages/cli/src/planReview/agentRevisionComments.ts`.
   - Functions:
     ```ts
     export async function readAgentRevisionComments(ctx: CliContext, value: string): Promise<AgentRevisionComments>;
     export function applyAgentRevisionComments(args: {
       existingThreads: CommentThread[];
       comments: AgentRevisionComments;
       attemptId: string;
       createdAt: IsoInstantString;
     }): { threads: CommentThread[]; pendingInlineComments: AgentRevisionInlineComment[] };
     ```
   - `readAgentRevisionComments` should treat values whose trimmed first character is `{` as inline JSON and all other values as file paths. Use the same Zod schema either way so inline and file input have identical validation semantics.
   - Validate unknown reply thread IDs and return a clear command error.
   - Create canonical agent messages with:
     ```ts
     const AGENT_AUTHOR = { id: 'agent', kind: 'agent', displayName: 'Agent' } as const;
     ```
   - Document comments become global threads with one agent message.
   - Inline comments remain pending until the UI resolves them.

9. **Add plan review attempt orchestration.**
   - Add `packages/cli/src/planReview/runPlanReviewAttempt.ts`.
   - It should:
     - destructure `ctx` at the top,
     - load existing review for `revisionOf`,
     - parse/apply agent comments for revisions,
     - call `runAnnotation(ctx, { ..., reviewContext }, deps)`,
     - persist via `ctx.planReviews.createOrReplaceAttempt(...)`,
     - return `{ submission, planId, attemptId, contentHash }`.
   - For initial reviews, generate `planId`/`attemptId` in memory before opening the browser, but only persist after browser submission succeeds.
   - For revisions, do not persist agent replies before the browser completes; persist the final submitted thread ledger in one transaction.

10. **Update `contextbridge plan` option parsing.**
    - Modify `packages/cli/src/commands/plan.ts`.
    - Extend `PlanArgs`:
      ```ts
      export interface PlanArgs {
        path?: string;
        port?: number;
        revisionOf?: string;
        agentComments?: string;
      }
      ```
    - Add commander options:
      ```ts
      .option('--revision-of <plan-id>', 'submit this plan as a revision of an existing PlanBridge plan')
      .option('--agent-comments <json-or-path>', 'inline JSON object or path to JSON containing agent replies/comments for this revision')
      ```
    - Validate:
      - `--agent-comments` without `--revision-of` aborts.
      - `--revision-of` without `--agent-comments` aborts.
      - plan content is still read from positional path when provided, otherwise stdin.
    - Replace the direct `runAnnotation` call with `runPlanReviewAttempt`.
    - Format stdout with the returned `planId`/`attemptId`.

11. **Update hooks to use storage-aware review orchestration.**
    - Modify `packages/cli/src/commands/hookClaude.ts` and `hookCodex.ts`.
    - Before opening PlanBridge, compute content hash and query `ctx.planReviews.findApprovedAttemptByHash({ projectRoot: ctx.projectRoot, contentHash })`.
      - Claude: return allow response if found.
      - Codex: return `null` if found.
    - Query `findActiveReviewForHarnessSession` using the hook `session_id`.
      - If found and content hash is not approved, return the formatted “use explicit revision command” denial/block message.
    - Otherwise call `runPlanReviewAttempt` with `harnessSessionId: payload.session_id`.
    - Update hook tests for approved-hash bypass and active-review blocking.

12. **Update markdown formatting for Plan IDs and Thread IDs.**
    - Modify `packages/cli/src/formatters/annotation/templates.ts`:
      - allow optional `planId`, `currentAttemptId`, and `revisionCommandExample` fields where needed.
    - Modify `packages/cli/src/formatters/annotation/markdown.ts`:
      - accept options:
        ```ts
        opts: { sourcePath?: string; planId?: string; currentAttemptId?: string }
        ```
      - include thread IDs in section headings.
      - when `currentAttemptId` is present, render only actionable threads containing a current-attempt user-authored message, while including full message history for those threads.
      - fallback to current behavior when `currentAttemptId` is absent.
    - Modify plan templates under `packages/cli/src/formatters/plan/templates/`:
      - `changesRequested.hbs` should include PlanBridge Plan ID and revision command instructions when `planId` exists.
      - `annotationSection.hbs` should include `Thread ID`.
      - `generalFeedbackSection.hbs` should include `Thread ID`.
    - Keep document/open templates unaffected except for type-compatible no-op optional fields.

13. **Update `runAnnotation` payload support.**
    - Modify `packages/cli/src/annotation/runAnnotation.ts`.
    - Extend `RunAnnotationArgs` with optional `reviewContext`.
    - Add `reviewContext: args.reviewContext` to the `AnnotationPayload` when present.
    - Include `review_mode`, `has_review_context`, and pending inline count in analytics if useful, without logging comment bodies.

14. **Update annotation UI state to handle review context.**
    - Modify `packages/annotation/src/App.tsx`.
    - Initialize `useAnnotationState` from `payload.reviewContext?.threads`, not just test props.
    - Pass `payload.reviewContext?.attemptId` and pending inline comments into the state/interactions layer.
    - Keep `initialThreads` props for tests/stories, but prefer payload review context when present.

15. **Model full sidebar thread histories.**
    - Modify `packages/annotation/src/annotationTypes.ts`.
    - Replace the single-primary-message assumption with a resolved union:
      ```ts
      type ResolvedCommentThread = ResolvedAnnotationThread | ResolvedGlobalThread;
      ```
    - `ResolvedAnnotationThread.comments` should include all saved messages, not only the first.
    - Add metadata for whether the thread/message is current-attempt user-authored.

16. **Resolve pending agent inline comments in the UI.**
    - Modify `packages/annotation/src/selectableTextIndex.ts` to expose source-line-aware resolution helpers such as:
      ```ts
      sourceLineToRange(selector: AgentInlineSelector): Range | null;
      ```
      or expose lower-level source-line span and `offsetsToRange` helpers if easier.
    - Add `packages/annotation/src/agentInlineCommentResolver.ts`.
    - For each pending inline comment:
      - locate the revised markdown source line by `selector.line`,
      - if `selector.match` is absent, use the rendered range for that source line when it maps to selectable text,
      - if `selector.match` is present, require it to appear exactly once within the specified source line before converting that match span to a DOM `Range`,
      - call `textIndex.rangeToAnchor(range, 'agent')`,
      - create an annotation thread with one agent message.
    - If an inline selector cannot be resolved because the line is missing/out of range, the rendered line is not selectable, the match is missing, or the match is duplicated within that line, downgrade it to a global thread with body prefix:

      ```text
      Agent inline note for source line <line> (match: "<match>") could not be attached:

      <original body>
      ```

      Omit the parenthesized match text when `selector.match` is absent, and log/capture a warning without throwing.

    - Ensure materialization runs once per `attemptId`/pending comment set to avoid duplicate agent threads on rerender.

17. **Update comment model creation helpers.**
    - Modify `packages/annotation/src/commentModel.ts`.
    - Replace hard-coded `createMessage(body)` with:
      ```ts
      createMessage({ body, author, attemptId }): CommentMessage
      ```
    - Keep local user author for human-created messages.
    - Add `appendThreadMessage`, `createThreadReplyMessage`, and `canEditMessage` helpers.
    - Ensure new user messages get `createdInAttemptId: currentAttemptId` when available.

18. **Update `useAnnotationState` for current-attempt semantics.**
    - Modify `packages/annotation/src/useAnnotationState.ts`.
    - State should hold all threads, not only annotation threads.
    - Add `currentAttemptId?: string` to args.
    - Compute feedback count as:
      ```ts
      countCurrentUserMessages(threads, currentAttemptId) + (trimmedGlobalDraft ? 1 : 0);
      ```
      If no `currentAttemptId` exists, preserve current behavior for standalone/open flows.
    - Submitting on a revision with no new user messages returns:
      ```ts
      { status: 'approved', threads: allThreads }
      ```
    - Submitting with new user feedback returns:
      ```ts
      { status: 'changes_requested', threads: allThreadsIncludingNewMessages }
      ```
    - Existing historical messages should be read-only; only current-attempt user-created drafts/messages can be edited/removed.

19. **Update sidebar components for global + annotation threads.**
    - Add or refactor components:
      - `packages/annotation/src/CommentThreadCard.tsx`
      - `packages/annotation/src/ThreadMessage.tsx`
    - Existing `AnnotationThreadCard.tsx` can either be refactored into the generic card or kept as an annotation-specific wrapper.
    - Render:
      - global/document-level threads with heading “Document comment”,
      - annotation threads with quote block as today,
      - each message with author label (`You` vs `Agent`) and timestamp.
    - Add a `Reply` action/composer for existing threads.
    - Hide/remove disable the remove button for historical and agent-authored threads.
    - Update test IDs as colocated exported constants.

20. **Update annotation resolvers/navigation.**
    - Modify `packages/annotation/src/annotationResolvers.ts`.
    - Return all saved messages for annotation threads.
    - Add global-thread resolution for sidebar display.
    - Keep annotation highlighting/navigation scoped to annotation threads with a valid range.
    - Global threads can appear in the sidebar but do not need to participate in J/K navigation for this iteration.

21. **Update submit/close copy behavior.**
    - Existing close-review dialog copy can remain, but its decision must use new feedback count.
    - Verify that a revision with only historical/agent messages shows approval copy/action, not submit-feedback copy.

22. **Update CLI tests.**
    - Extend `packages/cli/src/commands/plan.test.ts`:
      - rejects `--revision-of` without `--agent-comments`,
      - rejects `--agent-comments` without `--revision-of`,
      - accepts inline JSON and file-path `--agent-comments` inputs for revisions,
      - passes revision context to `runAnnotation`,
      - prints Plan ID and Thread IDs on changes requested,
      - persists approved revision hash.
    - Add tests for `agentRevisionComments.ts` parsing/application.
    - Update hook tests for approved-hash bypass and active-review blocking.
    - Update formatter tests for Plan ID, revision instructions, current-attempt filtering, and thread IDs.

23. **Update annotation UI tests.**
    - Modify `packages/annotation/src/App.test.tsx` and hook tests.
    - Add coverage for:
      - rendering prior user + agent messages in one thread,
      - approving a revision with historical threads but no new user feedback,
      - replying to an existing annotation thread changes status to `changes_requested`,
      - replying to a document/global thread changes status to `changes_requested`,
      - agent inline pending comment resolves by source line and optional unique match,
      - missing/out-of-range source line or missing/duplicated match downgrades to document/global thread,
      - historical messages are not editable/removable.

24. **Update server tests if payload schema assumptions change.**
    - `packages/server/src/routes/payload.test.ts` should accept payloads with `reviewContext`.
    - `packages/server/src/routes/submit.test.ts` should accept submissions with messages carrying `createdInAttemptId`.

25. **Update skills/install guidance if needed.**
    - Update generated/manual skill text only if it instructs agents how to use PlanBridge feedback loops.
    - If skill sources change, run:
      ```sh
      bun run skills:generate
      bun run skills:check
      ```

26. **Verification.**
    - During implementation, run focused package tests first:
      ```sh
      bun run --cwd packages/shared test
      bun run --cwd packages/storage test
      bun run --cwd packages/cli test
      bun run --cwd packages/annotation test
      ```
    - Before completion, run:
      ```sh
      just verify
      ```

## Testing Plan

### Unit tests required

- Shared schemas:
  - valid agent comments JSON parses with defaults,
  - inline selectors require positive integer `line`,
  - optional `match` must be trimmed/nonempty when provided,
  - invalid empty bodies reject,
  - unknown keys reject,
  - `createdInAttemptId` remains optional for backward compatibility.
- Agent comments parser/application:
  - parses inline JSON values whose trimmed first character is `{`,
  - parses JSON from file paths when the value does not start with `{`,
  - reports validation failures for both inline and file inputs,
  - appends replies to existing threads,
  - rejects unknown thread IDs,
  - creates canonical agent messages,
  - creates global threads for document comments,
  - leaves inline comments pending.
- Content hash/ID helpers:
  - stable hash for identical content,
  - different hash for changed content,
  - IDs have expected prefixes.
- Formatter:
  - changes-requested output includes Plan ID and thread IDs,
  - revision instructions are present only for plan reviews with a Plan ID,
  - current-attempt filtering excludes old-only threads from actionable feedback,
  - full history is included for threads with new current-attempt user messages.
- Storage repository:
  - all methods use real temp SQLite DBs,
  - snapshots round-trip through schema parsing,
  - approved hash lookup works,
  - active harness session lookup works.

### Integration tests needed

- `runPlan` new initial review:
  - stdin/path behavior unchanged,
  - changes-requested review persists a plan ID and prints it.
- `runPlan` revision:
  - loads prior review from repository,
  - parses agent comments from inline JSON and file path inputs,
  - sends merged threads and pending inline comments to `runAnnotation`,
  - persists final submitted ledger.
- Hook flow:
  - first feedback blocks and emits Plan ID,
  - explicit revision approval stores approved hash,
  - subsequent hook for same content hash allows/no-ops.
- Browser UI flow:
  - revision payload with historical threads renders full conversation,
  - no new user messages submits approval despite historical threads,
  - adding a reply submits `changes_requested` with all threads preserved.

### Edge cases to verify

- Missing `--agent-comments` value for a revision.
- Invalid inline JSON value.
- Invalid JSON file.
- File-path JSON succeeds when the argument does not start with `{`.
- Values whose trimmed first character is `{` are always treated as inline JSON, even if a path literally starts with `{`.
- Valid JSON with no replies/comments (`{ "version": 1 }`) should be accepted for revisions.
- Reply references a deleted/unknown thread ID.
- Inline selector `line` is missing, zero, negative, or non-integer; reject during schema validation.
- Inline selector without `match` attaches to the specified source line when that line maps to selectable rendered text.
- Inline selector references a source line that does not exist in the revised markdown; downgrade to global rather than crash.
- Inline selector `match` is present but not found on that source line; downgrade to global rather than crash.
- Inline selector `match` appears multiple times on the specified source line; downgrade to global rather than guess.
- Existing anchors from old plans become unresolved after revision; sidebar still shows thread history with “Needs restore”.
- Approval with historical threads includes those threads in the submission so storage does not lose the ledger.
- Storage failure after browser submission aborts with a clear runtime error and does not emit misleading stdout.
- Hook active-review blocking does not trigger when the content hash has already been approved.

## Files to Modify/Create

| Path                                                                    | Change                                                                                           | Status   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| `packages/shared/src/annotationSchema.ts`                               | Add revision/comment schemas, `reviewContext`, `createdInAttemptId`, and `createdFrom: 'agent'`. | Modified |
| `packages/shared/src/annotationSchema.test.ts`                          | Add schema coverage for revision comments and review context.                                    | Modified |
| `packages/shared/src/testFactories.ts`                                  | Add agent/revision/review-context factories.                                                     | Modified |
| `packages/storage/src/db/schema/planReviews.ts`                         | Add plan review table.                                                                           | Added    |
| `packages/storage/src/db/schema/planReviewAttempts.ts`                  | Add review attempt table.                                                                        | Added    |
| `packages/storage/src/db/schema/planReviewThreads.ts`                   | Add thread table.                                                                                | Added    |
| `packages/storage/src/db/schema/planReviewMessages.ts`                  | Add message table.                                                                               | Added    |
| `packages/storage/src/db/schema/index.ts`                               | Explicitly export new tables.                                                                    | Modified |
| `packages/storage/generated/drizzle/**`                                 | Generated migration for new tables; create via drizzle-kit, do not hand-edit.                    | Added    |
| `packages/storage/src/PlanReviewRepositoryImpl.ts`                      | Implement storage repository.                                                                    | Added    |
| `packages/storage/src/PlanReviewRepositoryImpl.test.ts`                 | Test repository with real temp SQLite DBs.                                                       | Added    |
| `packages/storage/src/index.ts`                                         | Export repository interface/implementation and related types.                                    | Modified |
| `packages/storage/src/testHelpers/factories/db.ts`                      | Add review/attempt/thread/message factories if useful.                                           | Modified |
| `packages/cli/package.json`                                             | Add `@contextbridge/storage` workspace dependency.                                               | Modified |
| `packages/cli/src/context.ts`                                           | Add `planReviews` to `CliContext` and instantiate repository.                                    | Modified |
| `packages/cli/src/testHelpers/FakePlanReviewRepository.ts`              | Fake repository for CLI handler tests.                                                           | Added    |
| `packages/cli/src/testHelpers/createStubContext.ts`                     | Include fake repository by default.                                                              | Modified |
| `packages/cli/src/testHelpers/index.ts`                                 | Export fake repository.                                                                          | Modified |
| `packages/cli/src/planReview/contentHash.ts`                            | Add plan content hashing helper.                                                                 | Added    |
| `packages/cli/src/planReview/ids.ts`                                    | Add prefixed ID helpers.                                                                         | Added    |
| `packages/cli/src/planReview/agentRevisionComments.ts`                  | Parse and apply agent revision comments.                                                         | Added    |
| `packages/cli/src/planReview/runPlanReviewAttempt.ts`                   | Storage-aware review orchestration helper.                                                       | Added    |
| `packages/cli/src/commands/plan.ts`                                     | Add `--revision-of` and `--agent-comments`; delegate to review helper.                           | Modified |
| `packages/cli/src/commands/plan.test.ts`                                | Add revision flag and persistence tests.                                                         | Modified |
| `packages/cli/src/commands/hookClaude.ts`                               | Add approved-hash bypass and active-review blocking; use review helper.                          | Modified |
| `packages/cli/src/commands/hookClaude.test.ts`                          | Add hook continuation tests.                                                                     | Modified |
| `packages/cli/src/commands/hookCodex.ts`                                | Add approved-hash bypass and active-review blocking; use review helper.                          | Modified |
| `packages/cli/src/commands/hookCodex.test.ts`                           | Add Codex continuation tests.                                                                    | Modified |
| `packages/cli/src/annotation/runAnnotation.ts`                          | Pass optional review context into payload.                                                       | Modified |
| `packages/cli/src/annotation/runAnnotation.test.ts`                     | Assert review context is included when supplied.                                                 | Modified |
| `packages/cli/src/formatters/annotation/templates.ts`                   | Extend template argument types for Plan IDs/thread IDs.                                          | Modified |
| `packages/cli/src/formatters/annotation/markdown.ts`                    | Render plan IDs/thread IDs and current-attempt actionable feedback.                              | Modified |
| `packages/cli/src/formatters/annotation/markdown.test.ts`               | Add formatter coverage.                                                                          | Modified |
| `packages/cli/src/formatters/plan/templates/changesRequested.hbs`       | Add Plan ID and revision command instructions.                                                   | Modified |
| `packages/cli/src/formatters/plan/templates/annotationSection.hbs`      | Add thread ID.                                                                                   | Modified |
| `packages/cli/src/formatters/plan/templates/generalFeedbackSection.hbs` | Add thread ID.                                                                                   | Modified |
| `packages/server/src/routes/payload.test.ts`                            | Add payload review-context coverage.                                                             | Modified |
| `packages/server/src/routes/submit.test.ts`                             | Add submission message metadata coverage.                                                        | Modified |
| `packages/annotation/src/App.tsx`                                       | Read review context from payload and pass into state/interactions.                               | Modified |
| `packages/annotation/src/annotationTypes.ts`                            | Add resolved global/thread-history types.                                                        | Modified |
| `packages/annotation/src/commentModel.ts`                               | Create messages with authors/attempt IDs; append replies.                                        | Modified |
| `packages/annotation/src/useAnnotationState.ts`                         | Store all threads and compute current-attempt feedback count.                                    | Modified |
| `packages/annotation/src/annotationResolvers.ts`                        | Resolve all messages and global threads for sidebar.                                             | Modified |
| `packages/annotation/src/selectableTextIndex.ts`                        | Expose source-line/range resolution helper for agent inline comments.                            | Modified |
| `packages/annotation/src/agentInlineCommentResolver.ts`                 | Materialize pending inline agent comments.                                                       | Added    |
| `packages/annotation/src/CommentThreadCard.tsx`                         | Generic sidebar card for global/annotation thread histories.                                     | Added    |
| `packages/annotation/src/ThreadMessage.tsx`                             | Render user/agent message rows.                                                                  | Added    |
| `packages/annotation/src/AnnotationThreadCard.tsx`                      | Refactor or wrap generic card; remove primary-message assumption.                                | Modified |
| `packages/annotation/src/CommentsSidebar.tsx`                           | Render global and annotation threads; support reply handlers.                                    | Modified |
| `packages/annotation/src/useAnnotationInteractions.ts`                  | Account for materialized agent inline comments and resolved thread union.                        | Modified |
| `packages/annotation/src/useCommentNavigation.ts`                       | Keep navigation scoped to resolved annotation threads.                                           | Modified |
| `packages/annotation/src/App.test.tsx`                                  | Add revision/thread-history UI coverage.                                                         | Modified |
| `packages/annotation/src/useAnnotationState.test.ts`                    | Add current-attempt status/count tests.                                                          | Modified |
| `packages/annotation/src/useCommentNavigation.test.tsx`                 | Update expectations if resolved thread type changes.                                             | Modified |
| `packages/skills/sources/planbridge-open/SKILL.md`                      | Optional: update if manual skill should mention revision flow.                                   | Modified |
| `packages/skills/sources/planbridge-last/SKILL.md`                      | Optional: update if manual skill should mention revision flow.                                   | Modified |
| `packages/website/src/**`                                               | Optional docs update for new revision command.                                                   | Modified |

## Additional Notes

- The W3C Web Annotation Data Model backs the existing body/target + selector direction. We are not adopting JSON-LD, but the current TextQuote/TextPosition approach is consistent with that model and should remain the foundation.
- Keep agent-facing IDs stable and visible. Thread IDs should appear in every feedback section because the agent needs them for `replies[].threadId`.
- Do not expose `StoredAnnotationAnchor` as agent input. It is an internal/browser-derived representation.
- This feature is large enough that it can be split into reviewable PRs:
  1. shared schemas + storage repository,
  2. CLI revision flag + persistence + formatter output,
  3. hook approved-hash bypass/active-review blocking,
  4. UI thread-history/current-attempt behavior,
  5. pending inline agent comment resolution.
- If implementation needs to reduce scope, ship replies + document-level comments first and leave inline agent comments behind a follow-up. The schema can still include inline comments, but the CLI can initially reject them with a clear “inline agent comments are not supported yet” error. The full target plan above includes inline support.
