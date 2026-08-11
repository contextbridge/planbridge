# Plan review UI design language

Constraints for the plan review UI (and sibling review UIs that will
follow the same pattern — add their path globs above when they land).
The tool is for developers marking up an AI-generated plan:
utilitarian, scannable, dense. These rules exist because the instinct
to reach for "soft product surface" — rounded cards, shadows, blur,
tinted fills — produces a consumer-SaaS aesthetic that fights the
content. Deletion is usually the right move.

## Containers

- **No card-in-a-card shells.** Primary content sits directly on the
  page background. Structural panels may carry a thin border for
  separation, nothing else.
- **Small radii only.** Pill or chip-shaped radii belong to marketing
  surfaces, not here.
- **No decorative shadows on static content.** Shadows are reserved
  for genuinely floating surfaces (dialogs, annotation popovers).
- **No `backdrop-blur` on static panels.** There is nothing meaningful
  behind them to blur; it is shader cost for zero signal.
- **No tinted card fills.** Solid theme-token fills only.

## Alerts, callouts, error states

- Prefer an unobtrusive leading rule or stripe over a tinted-card
  alert. The content is the signal, not the container.
- If a fill is unavoidable (e.g. blockquote), keep it subtle and stick
  to the theme's standard opacity steps — off-step values silently
  round and muddy the output.

## Typography

- **One prose typeface** for body + chrome, **one monospace typeface**
  for code. Keep them scoped; do not leak the mono face into prose.
- **The brand typeface is for the wordmark only.** It is not a heading
  font. Plan-body headings inherit the prose face.
- **Tool-scale heading sizes.** Keep headings close to body-text
  scale. Marketing-page scales (display sizes) are out.
- **No fractional near-default sizes.** Pick a standard step and
  commit — adjusting sizes by a fraction of an em is noise.
- **Rhythm over ornament.** Spacing carries structure: heading-to-
  paragraph gaps should be tighter than section-break gaps.

## Buttons

- **Title Case** for all button labels.
- **Primary color is fine for "submit feedback"** — it is the expected
  action in this workflow, not a negative one. Do not reach for
  red / orange / green to imply good-vs-bad; that misframes the review
  as judgmental.
- **Prefer one contextual button over two mutually-exclusive buttons.**
  When exactly one action is legal at a time, a single button whose
  label tracks state reads cleaner than a pair with one perpetually
  disabled.

## Chrome / header

- The utility bar is austere by rule: no shadow, no tint, no
  background fill — just a thin bottom rule. Brand mark + wordmark on
  the left, version info on the right, empty middle.
- **Do not fill the middle** with plan metadata, taglines, or
  navigation unless there is a concrete ergonomic need. Start austere;
  add only on demonstrated need.
- The brand mark inherits color via `currentColor`. Do not hardcode
  fill.

## When this rule does not apply

- `packages/website` is a marketing surface — the soft product surface
  aesthetic is appropriate there.
- shadcn primitives under `@contextbridge/ui/components/ui/*` follow
  their upstream defaults; do not retune them here.

## Skeptic check before adding visual weight

Before adding a card, shadow, larger radius, or colored fill, ask:
*does this communicate something the content cannot?* If the answer
is no, the right move is to delete, not add.
