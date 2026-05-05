---
paths:
  - "packages/**/*.tsx"
  - "packages/**/src/**/use*.ts"
---

# React hook design

Four recurring design decisions when writing or reviewing a custom React hook.

## 1. Derive state during render, not in a corrective `useEffect`

When one piece of state's validity depends on another, compute the valid value during render. Do **not** write an effect whose job is to "fix up" state after the fact.

**Bad — corrective effect:**

```tsx
const [activeId, setActiveId] = useState<string | null>(null);

useEffect(() => {
  if (activeId && !items.some((item) => item.id === activeId)) {
    setActiveId(null);
  }
}, [activeId, items]);
```

Cascading render: items change → commit → effect fires → setState → second render. Also triggers `react-hooks/set-state-in-effect`.

**Good — derive during render:**

```tsx
const [activeIdState, setActiveId] = useState<string | null>(null);
const activeId =
  activeIdState && items.some((item) => item.id === activeIdState) ? activeIdState : null;
```

Return `activeId` (the derived view) to consumers. Keep `setActiveId` (the raw setter). Stale values become `null` on the next render automatically.

**Unavoidable corrective effects:** when the "fix" depends on an external system (DOM measurements, a non-React store). For pure state-derived-from-state, always derive during render.

## 2. Group hook returns into cohesive sub-objects when the flat list grows

A hook returning 15+ flat fields pushes that flatness into every consumer. 4 well-named sub-objects with 4 fields each reads cleaner at call sites.

**Before — flat:** 20+ fields in a single object.

**After — grouped:**

```ts
return {
  threads,
  draft: { active, openAnnotation, openGlobal, close, setBody, save },
  globalComment: { body, expanded, exists, setBody, setFocused, submit },
  submission: { submit, submitting, error, submitted, label, feedbackCount },
  removal: { pendingId, request, confirm },
};
```

**Heuristic**: ~10 flat returns is fine. 15+ is usually cleaner grouped. Groups should be cohesive (all fields for one concern), not alphabetical or size-balanced.

## 3. Don't split a cohesive hook into micro-hooks

When a single hook owns many pieces of state for one coordinated concern (a session, a form, a document), the right refactor is usually to reshape its **return API** (rule 2), not to split into 5 smaller hooks that depend on each other.

**Why splitting often makes things worse:**

- Five hooks that each need `threads` as an argument recreate the same coordination problem at the composition layer.
- Callers orchestrate between hooks, turning one readable hook into a fragile multi-hook dance with `onRemoved`-style callbacks.
- You trade one legibility problem (big hook) for a worse one (hook soup).

**When splitting *is* right:**

- Concerns are genuinely independent (e.g. `useOnlineStatus` has nothing to do with form state).
- One concern is reusable across unrelated features.
- The hooks don't need to coordinate via callbacks.

If two proposed sub-hooks would end up passing a callback to each other, leave them as one hook.

## 4. Push orchestration callbacks into the hook, not the component

If a component's render function contains a multi-step arrow that calls both a hook's method and a sibling hook's method, the orchestration belongs inside one of the hooks.

**Before — orchestration in render:**

```tsx
<CommentsSidebar
  onAnnotationHoverChange={(id, hovered) => {
    annotationInteractions.setActiveAnnotationId(hovered ? id : null);
  }}
  onGlobalCommentClick={(thread, element) => {
    annotationInteractions.setActiveAnnotationId(null);
    reviewState.openGlobalCommentDraft(thread, () => element.getBoundingClientRect());
  }}
/>
```

**After — hook owns the logic:**

```tsx
const setAnnotationHover = (id: string, hovered: boolean) => {
  setActiveAnnotationId(hovered ? id : null);
};

const openGlobalCommentDraft = (thread: CommentThread, element: HTMLElement) => {
  setActiveDraft({
    kind: 'global',
    threadId: thread.id,
    getRect: () => element.getBoundingClientRect(),
  });
};

<CommentsSidebar
  onAnnotationHoverChange={annotationInteractions.setAnnotationHover}
  onGlobalCommentClick={handleGlobalCommentClick}
/>
```

Where multi-hook coordination is unavoidable (a handler that touches two hooks' state), extract it as a named function above the return — not an inline arrow inside JSX.

## How these interact

All four point at the same goal: **consumers of a hook should read prop-passing sites like a table of contents, not a script.** Render functions exist to wire state into UI, not compose multi-step logic.

## Skeptic check before applying rule 2 or 3

Before regrouping or splitting, ask: *who else consumes this hook?* If the only consumer is one component in the same file, these are internal refactors — safe. If the hook is imported across a package, reshape the return in one commit and update consumers in the same PR so nothing breaks mid-way.
