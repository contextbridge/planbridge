// V2 of the auth-refactor plan from samplePlans.ts. Hand-edited so the
// iteration-diff prototype has realistic modified / added / removed / reordered
// blocks to highlight. Line numbers below are the line in this string and are
// what the iterationChanges descriptors reference.

export const samplePlanV2 = `# Refactor auth middleware

This change consolidates our session-token handling into a single well-tested module and replaces the ad-hoc JWT checks sprinkled across the request pipeline. The goal is a single trusted entry point for session validation so that login, refresh, and admin impersonation all share the same verifier.

## Goals

- Eliminate the three duplicated JWT-parsing code paths that drifted over the last year.
- Introduce a Zod-validated cookie schema that accepts every currently-issued legacy payload and surfaces malformed tokens with actionable errors.
- Give the security team a single integration point for future changes (rotation, revocation, audit logging).

## Non-goals

- Migrating existing users off of opaque session tokens.
- Changing the session TTL or refresh semantics.
- Touching the OAuth callback flow — that code already routes through a separate verifier.

## Plan

1. Extract session-token handling into its own module.
2. Add a Zod schema for the cookie payload.
3. Replace manual JWT checks with the new verifier and **document the migration path** for downstream callers before the swap, so on-call has the runbook in hand.
4. Update integration tests to hit the real session store.
5. Wire the new verifier into the admin impersonation path behind a feature flag.
6. Add a kill-switch flag, separate from the rollout flag, that routes 100% of traffic back to the legacy verifier in one click.
7. Flip the flag on staging for a full business day and watch error rates before promoting to production.

> This rollout touches login, session refresh, and admin impersonation. Spell out the order carefully.

### Verifier signature

\`\`\`ts
export async function verifySession(cookie: string) {
  return parseCookie(cookie);
}
\`\`\`

### Migration helper

\`\`\`ts
export async function migrateLegacyCookie(legacy: string) {
  const parsed = await parseLegacyCookie(legacy);
  return issueNewCookie(parsed);
}
\`\`\`

| Area | Planned change | Risk |
| --- | --- | --- |
| Auth middleware | Move token parsing to a shared module | Existing routes may bypass the new verifier |
| Session store | Hit the real store in integration tests | Test fixtures may become slower |
| Admin impersonation | Route through the same verifier as user sessions, with bespoke error messages preserved via a thin adapter | Admin tooling may lose its bespoke error messages |
| Login endpoint | Swap in the new cookie schema | Older clients with stale cookies need a grace period |

## Rollout

We will roll this out in four stages. Each stage is gated on the previous stage's error rate staying flat for at least 24 hours. The stages are: staging shadow, staging cutover, production shadow, production cutover. Shadow stages run the new verifier in parallel with the old one and log disagreements without affecting the response.

If any stage trips the kill-switch threshold (>0.5% verifier disagreement or any 5xx attributable to the new path) we automatically revert to legacy and page the on-call. The kill-switch is owned by SRE; promoting past it is a manual decision by the security team.

### Stage 1 — staging shadow

Deploy the new verifier behind a shadow flag. Compare its output against the existing JWT check on every request and log mismatches with enough context to reconstruct the original cookie. Expect a small number of mismatches from expired-but-still-accepted tokens; those are documented in the runbook as acceptable.

### Stage 2 — staging cutover

Flip the flag so staging uses the new verifier as the source of truth. Keep the old verifier running in shadow so we can compare in the opposite direction. Hold for one full business day before advancing.

### Stage 3 — production shadow

Deploy the new verifier to production behind the same shadow flag. This is the riskiest stage because production cookies have a much wider variety of ages, issuers, and formats. Watch the mismatch log carefully.

### Stage 4 — production cutover

Flip the flag in production. Keep the old verifier available as a fallback for 7 days. After 7 days, delete the old verifier and close out the migration.

## Success criteria

- Zero increase in 4xx auth responses after the production cutover.
- Session verification p99 latency drops below 5ms (current baseline: 8ms).
- One shared verifier used by login, refresh, and admin impersonation with zero remaining call sites on the legacy implementation.

## Open questions

- Should the Zod schema live in \`@contextbridge/shared\` or a new dedicated package like \`@contextbridge/auth-schemas\`? Sharing it broadens the blast radius of future schema changes.
- Do we want a synthetic monitor that issues legacy cookies and asserts they continue to verify for the duration of the 7-day fallback window?

## Appendix — affected files

- \`packages/api/src/auth/verifier.ts\`
- \`packages/api/src/auth/cookies.ts\`
- \`packages/api/src/middleware/session.ts\`
- \`packages/admin/src/impersonate.ts\`
- \`packages/api/src/routes/login.ts\`
- \`packages/api/src/routes/refresh.ts\``;
