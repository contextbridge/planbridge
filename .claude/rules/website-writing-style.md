---
paths:
  - "packages/website/src/**/*.mdx"
  - "packages/website/src/**/*.astro"
---

# Website writing style

Copy on the docs and marketing site has to read like a human staff engineer wrote it, not a model. AI-generated text has a recognizable cadence and vocabulary, and readers register it as low-trust the same way they register stock photography.

Apply this when writing or editing prose in `packages/website/`. Code samples, frontmatter, and the auto-generated CLI reference pages under `src/content/docs/cli/` are out of scope (their wording lives in the CLI's Commander definitions).

## Avoid

### Em dashes (—)

LLMs default to em dashes for everything. They show up everywhere in model output and almost never in the working notes of a real engineer. Default to a period or a comma. If you genuinely need a parenthetical aside, parentheses or a colon usually work better.

Em dashes used very sparingly are fine. "One per page" is a reasonable budget; "one per paragraph" is a tell.

### "Not just X, it's Y" framings

And siblings: "X isn't just Y, it's Z", "more than just X", "where X meets Y", "X meets Y". These read as profound and say nothing.

### Filler hype words

"Robust", "comprehensive", "seamless", "powerful", "cutting-edge", "elegant", "lightweight", "intuitive", "effortless", "blazing fast", "first-class", "next-generation". Replace with a concrete claim or delete. "A robust local server" becomes "a Bun HTTP server", or nothing at all.

### Triplet rhythms

"Fast, simple, and powerful." "Configure, deploy, and scale." Pick the one that is actually true. Cut the other two.

### Dual-audience hedging

"Whether you're new to AI tooling or running an agentic stack in production..." Pick one audience for that sentence and write to them.

### Hedging openers

"It's worth noting that...", "It's important to remember...", "Note that...", "Of course,...", "That said,...". Delete the opener and write the sentence.

### Closing flourishes

"In conclusion", "ultimately", "at the end of the day", "to wrap up", "happy hacking". End on the last fact.

### Verbs the model loves

"Delve", "embark", "leverage", "harness", "unlock", "elevate", "tap into", "dive into", "supercharge", "streamline". Use plain ones: use, build, run, ship, replace.

### Bold on connectives

`**and**`, `**or**`, `**even**` for emphasis is a model tic. Bold the concept, not the conjunction.

### Parallel intensifier pairs

"Fast and reliable", "secure and scalable", "simple yet powerful". If both halves carry weight, they need separate sentences. If only one carries weight, drop the other.

## Aim for

- **Concrete.** "Opens your browser to a local review UI" beats "delivers a seamless review experience".
- **Specific.** Numbers, file paths, command names, real example output. "Returns in <100ms on a 50-line plan" is worth more than "fast".
- **Active voice.** "ContextBridge starts a server" instead of "a server is started by ContextBridge".
- **Short.** If a sentence runs three lines, it is two sentences.
- **Point of view.** Address the reader as "you". The product is "ContextBridge", not "we" or "our team", unless you actually mean the team.

## Sanity check

Read the paragraph out loud. If it sounds like a press release or a LinkedIn post, rewrite. If it sounds like the way you'd explain the thing to a teammate at a whiteboard, keep it.
