export const samplePlan = `# Refactor auth middleware

This change consolidates our session-token handling into a single well-tested module and replaces the ad-hoc JWT checks sprinkled across the request pipeline. The goal is a single trusted entry point for session validation so that login, refresh, and admin impersonation all share the same verifier.

## Goals

- Eliminate the three duplicated JWT-parsing code paths that drifted over the last year.
- Introduce a Zod-validated cookie schema so malformed tokens surface with actionable errors.
- Give the security team a single integration point for future changes (rotation, revocation, audit logging).

## Non-goals

- Migrating existing users off of opaque session tokens.
- Changing the session TTL or refresh semantics.
- Touching the OAuth callback flow — that code already routes through a separate verifier.

## Plan

1. Extract session-token handling into its own module.
2. Add a Zod schema for the cookie payload.
3. Replace manual JWT checks with the new verifier and **document the migration path** for downstream callers.
4. Update integration tests to hit the real session store.
5. Wire the new verifier into the admin impersonation path behind a feature flag.
6. Flip the flag on staging for a full business day and watch error rates before promoting to production.

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
| Admin impersonation | Route through the same verifier as user sessions | Admin tooling may lose its bespoke error messages |
| Login endpoint | Swap in the new cookie schema | Older clients with stale cookies need a grace period |

## Rollout

We will roll this out in four stages. Each stage is gated on the previous stage's error rate staying flat for at least 24 hours. The stages are: staging shadow, staging cutover, production shadow, production cutover. Shadow stages run the new verifier in parallel with the old one and log disagreements without affecting the response.

### Stage 1 — staging shadow

Deploy the new verifier behind a shadow flag. Compare the output of the new verifier against the existing JWT check for every request and log any mismatch with enough context to reconstruct the original cookie. Expect a small number of mismatches from expired-but-still-accepted tokens; those are acceptable and documented in the runbook.

### Stage 2 — staging cutover

Flip the flag so staging uses the new verifier as the source of truth. Keep the old verifier running in shadow so we can compare in the opposite direction. Hold for one full business day before advancing.

### Stage 3 — production shadow

Deploy the new verifier to production behind the same shadow flag. This is the riskiest stage because production cookies have a much wider variety of ages, issuers, and formats. Watch the mismatch log carefully.

### Stage 4 — production cutover

Flip the flag in production. Keep the old verifier available as a fallback for 7 days. After 7 days, delete the old verifier and close out the migration.

## Open questions

- Do we need to keep the old verifier around as a fallback for legacy cookies issued before the rotation? If yes, for how long — a week, a month, until the next scheduled cookie rotation?
- Should the Zod schema live in \`@contextbridge/shared\` or a new dedicated package like \`@contextbridge/auth-schemas\`? Sharing it broadens the blast radius of future schema changes.
- Who owns the runbook for the feature-flag flip — SRE, security, or the product team whose surface the flag affects most?

## Success criteria

- Zero increase in 4xx auth responses after the production cutover.
- Session verification p99 latency drops below 5ms (current baseline: 8ms).
- One shared verifier used by login, refresh, and admin impersonation with zero remaining call sites on the legacy implementation.

## Appendix — affected files

- \`packages/api/src/auth/verifier.ts\`
- \`packages/api/src/auth/cookies.ts\`
- \`packages/api/src/middleware/session.ts\`
- \`packages/admin/src/impersonate.ts\`
- \`packages/api/src/routes/login.ts\`
- \`packages/api/src/routes/refresh.ts\``;
