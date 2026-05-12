const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const PINK = `${ESC}38;2;217;123;175m`;
const ORANGE = `${ESC}38;2;217;119;6m`;
const GREEN = `${ESC}38;2;74;222;128m`;
const BLUE = `${ESC}38;2;96;165;250m`;
const MUTED = `${ESC}38;2;113;113;122m`;
const FOREGROUND = `${ESC}38;2;230;230;230m`;

const BANNER_RULE = '─'.repeat(125);

export const banner = [
  `${ORANGE} ▐▛███▜▌${RESET}   ${BOLD}${FOREGROUND}Claude Code${RESET} ${MUTED}v2.1.121${RESET}`,
  `${ORANGE}▝▜█████▛▘${RESET}  ${FOREGROUND}Opus 4.7 (1M context)${RESET} ${MUTED}with xhigh effort · Claude Max${RESET}`,
  `${ORANGE}  ▘▘ ▝▝${RESET}    ${MUTED}~/code/stripe-webhooks${RESET}`,
  '',
  `${MUTED}${BANNER_RULE}${RESET}`,
  '',
];

export const userPrompt =
  "Our Stripe webhook handler isn't idempotent — we double-process invoice.paid events when Stripe retries during a deploy.";

export const successLine = `🎉 ${PINK}Idempotent Stripe webhook ingestion shipped.${RESET}`;

export const planGenerationLines = [
  '',
  `${BLUE}●${RESET} Reading repo structure…`,
  `${MUTED}  • packages/api/src/webhooks/stripe.ts${RESET}`,
  `${MUTED}  • packages/api/src/db/schema.ts${RESET}`,
  '',
  `${BLUE}●${RESET} Drafting plan…`,
  `${MUTED}  Add stripe_event_log table keyed on event.id${RESET}`,
  `${MUTED}  Insert event row before signature verification${RESET}`,
  `${MUTED}  Stamp processed_at inside the dispatch transaction${RESET}`,
  '',
];

export const handoffLine = `${ORANGE}↗${RESET} Sent plan to ${PINK}PlanBridge${RESET} for review…`;

export const refiningLines = [
  '',
  `${ORANGE}↙${RESET} ${PINK}PlanBridge${RESET} returned 2 annotations.`,
  '',
  `${BLUE}●${RESET} Refining plan with feedback…`,
  `${MUTED}  • Verify signature first; insert event row only after constructEvent succeeds${RESET}`,
  `${MUTED}  • Wrap constructEvent and return 400 on bad sigs${RESET}`,
  '',
  `${GREEN}✓${RESET} Updated step 2: signature verification moved before insert.`,
  `${GREEN}✓${RESET} Updated handler sketch: catch bad-signature errors.`,
  '',
];

export const reopenLine = `${ORANGE}↗${RESET} Sent refined plan to ${PINK}PlanBridge${RESET}…`;

export const implementationLines = [
  '',
  `${ORANGE}↙${RESET} ${PINK}PlanBridge${RESET}: plan approved.`,
  '',
  `${BLUE}●${RESET} Implementing…`,
  `${GREEN}✓${RESET} Created migration: stripe_event_log`,
  `${GREEN}✓${RESET} Wrote handler: packages/api/src/webhooks/stripe.ts`,
  `${GREEN}✓${RESET} Added test: replay scenario covered`,
  `${GREEN}✓${RESET} All tests passing (47/47)`,
  '',
];
