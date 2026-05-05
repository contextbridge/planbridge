import { buildInfo as buildInfoFactory } from '@contextbridge/context/testFactories';
import type { Meta, StoryObj } from '@storybook/react-vite';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { withAppContext } from '../.storybook/appContextDecorator.tsx';
import { App } from './App.tsx';
import { annotationPopoverTestIds } from './AnnotationPopover.tsx';
import { markdownPlanTestIds } from './MarkdownPlan.tsx';
import { submitBarTestIds } from './SubmitBar.tsx';
import { DemoStage } from './demo/DemoStage.tsx';
import {
  banner,
  handoffLine,
  implementationLines,
  planGenerationLines,
  refiningLines,
  reopenLine,
  successLine,
  userPrompt,
} from './demo/claudeCodeFrames.ts';
import { samplePlan } from './demo/samplePlans.ts';
import { dumpLines, streamLines } from './demo/terminalScript.ts';
import type { TerminalHandle } from './demo/TerminalWindow.tsx';

const meta = {
  title: 'Plan/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

const seededThreads = [
  {
    id: 'thr_story_01',
    subject: {
      kind: 'annotation' as const,
      anchor: {
        createdFrom: 'element' as const,
        sourceLines: { start: 14, end: 14 },
        quote: {
          exact: 'document the migration path',
          prefix: 'ace manual JWT checks with the new verifier and ',
          suffix: ' for downstream callers.\nUpdate integration test',
        },
        position: {
          start: 974,
          end: 1001,
        },
        endpoints: {
          start: {
            targetId: 'strong:0:67f89842',
            offset: 0,
          },
          end: {
            targetId: 'strong:0:67f89842',
            offset: 27,
          },
        },
        target: {
          id: 'strong:0:67f89842',
          kind: 'inline' as const,
          label: 'Bold text: "document the migration path"',
        },
        snapshot: {
          targetText: 'document the migration path',
          blockText:
            'Replace manual JWT checks with the new verifier and document the migration path for downstream callers.',
        },
      },
    },
    messages: [
      {
        id: 'msg_story_01',
        author: {
          id: 'local-user',
          kind: 'human' as const,
          displayName: 'You',
        },
        body: 'Why does the doc step happen after the verifier swap instead of before it?',
        createdAt: '2026-04-20T12:34:56.000Z',
      },
    ],
  },
];

const seededGlobalComment = 'The plan never says how rollback works if the verifier swap causes issues.';

const overflowingCommentBodies = [
  'Why does the doc step happen after the verifier swap instead of before it?',
  'How long do we keep the legacy verifier around once the flag flips in production?',
  'What does the rollback path look like if a stage 3 mismatch spike is detected?',
  'Is there a runbook entry for the on-call SRE if shadow-mode logs flood the pipeline?',
  'Who owns the decision to extend stage 1 if mismatch rates do not flatten in 24h?',
  'Should admin impersonation be cut over in the same flag flip or staged separately?',
  'Are we measuring p99 latency per call site or across the whole verifier surface?',
  'Does the new Zod schema accept the same legacy cookie payloads we issue today?',
  'What is the plan for cookies signed by the previous rotation key?',
  'Will the shadow comparison log enough context to reconstruct mismatched cookies?',
  'Are we adding a feature flag kill-switch separate from the rollout flag?',
  'How do we surface schema-validation failures to clients without leaking internals?',
  'Does the integration test suite cover the impersonation re-entry path?',
  'Should we add a metric for cookies that pass legacy but fail the new verifier?',
  'How do we handle clock skew between issuer and verifier in production?',
  'Are session refresh tokens validated through the same code path post-cutover?',
  'Will security review sign off before stage 4 or only after the 7-day fallback window?',
  'Do we need a dashboard for the mismatch log, or is grepping the logs sufficient?',
  'What happens if the new verifier throws — do we fall through to the legacy one?',
  'Is the cookie-rotation interaction documented anywhere outside this plan?',
];

const overflowingThreads = overflowingCommentBodies.map((body, index) => ({
  ...seededThreads[0]!,
  id: `thr_overflow_${String(index).padStart(2, '0')}`,
  messages: [
    {
      ...seededThreads[0]!.messages[0]!,
      id: `msg_overflow_${String(index).padStart(2, '0')}`,
      body,
    },
  ],
}));

const delayedSubmit = async () => {
  await new Promise((resolve) => setTimeout(resolve, 200));
};

export const Default: Story = {
  args: {
    initialPayload: {
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { source: 'stdin' },
    },
  },
  decorators: [withAppContext({ submitPlanReview: delayedSubmit })],
};

export const SeededReview: Story = {
  args: {
    initialPayload: {
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { source: 'file' },
    },
    initialThreads: seededThreads,
    initialGlobalComment: seededGlobalComment,
  },
  decorators: [withAppContext({ submitPlanReview: delayedSubmit })],
};

export const OverflowingComments: Story = {
  args: {
    initialPayload: {
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { source: 'file' },
    },
    initialThreads: overflowingThreads,
  },
  decorators: [withAppContext({ submitPlanReview: delayedSubmit })],
  parameters: {
    docs: {
      description: {
        story:
          'Reproduces CON-1100. Confirms the comment list scrolls inside the sidebar and the Submit button stays in view when many FAQ comments are present.',
      },
    },
  },
};

export const Loading: Story = {
  decorators: [withAppContext({ fetchPayload: () => new Promise<never>(() => {}) })],
};

export const EmptyPlan: Story = {
  args: {
    initialPayload: { content: '', metadata: { source: 'file' } },
  },
};

export const WithUpdateNoticeStable: Story = {
  args: {
    initialPayload: {
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { source: 'file' },
    },
  },
  decorators: [
    withAppContext({
      fetchUpdateNotice: () =>
        Promise.resolve({
          currentVersion: '0.1.0',
          latestVersion: '0.2.0',
          channel: 'stable',
        }),
    }),
  ],
};

export const WithUpdateNoticeAlpha: Story = {
  args: {
    initialPayload: {
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { source: 'file' },
    },
  },
  decorators: [
    withAppContext({
      fetchUpdateNotice: () =>
        Promise.resolve({
          currentVersion: '0.1.0-alpha.1',
          latestVersion: '0.1.0-alpha.3',
          channel: 'alpha',
        }),
    }),
  ],
};

declare global {
  interface Window {
    __demoComplete?: boolean;
    __skipDemoPlay?: boolean;
  }
}

const demoPlan = `# Plan: Idempotent Stripe webhook ingestion

## Context

Stripe occasionally double-applies \`invoice.paid\` events when retrying during a deploy. We need an idempotency layer that survives restarts and concurrent delivery.

## Steps

1. Add a \`stripe_event_log\` table keyed on \`event.id\` with \`received_at\`, \`processed_at\`, and \`payload jsonb\`.
2. On ingest, **insert the event row before signature verification** so we have a durable audit trail of every delivery attempt.
3. Dispatch the handler inside a transaction that stamps \`processed_at\`. If already set, short-circuit with 200.

## Handler sketch

\`\`\`ts
export async function handleStripeWebhook(req, ctx) {
  const raw = await req.text();
  const event = JSON.parse(raw);
  await ctx.db.insert(stripeEventLog).values({ id: event.id, payload: event });
  const ok = ctx.stripe.webhooks.constructEvent(
    raw,
    req.headers.get('stripe-signature'),
    ctx.env.STRIPE_WEBHOOK_SECRET,
  );
  if (!ok) return new Response('bad sig', { status: 400 });
  return dispatch(event, ctx);
}
\`\`\`
`;

const refinedDemoPlan = `# Plan: Idempotent Stripe webhook ingestion

## Context

Stripe occasionally double-applies \`invoice.paid\` events when retrying during a deploy. We need an idempotency layer that survives restarts and concurrent delivery.

## Steps

1. Add a \`stripe_event_log\` table keyed on \`event.id\` with \`received_at\`, \`processed_at\`, and \`payload jsonb\`.
2. **Verify the Stripe signature first** with \`constructEvent\`. Only after it succeeds do we insert the event row, so we never persist forged payloads.
3. Dispatch the handler inside a transaction that stamps \`processed_at\`. If already set, short-circuit with 200.

## Handler sketch

\`\`\`ts
export async function handleStripeWebhook(req, ctx) {
  const raw = await req.text();
  let event;
  try {
    event = ctx.stripe.webhooks.constructEvent(
      raw,
      req.headers.get('stripe-signature'),
      ctx.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response('bad sig', { status: 400 });
  }
  await ctx.db.insert(stripeEventLog).values({ id: event.id, payload: event });
  return dispatch(event, ctx);
}
\`\`\`
`;

export const DemoFlow: Story = {
  args: {
    initialPayload: {
      content: demoPlan,
      title: 'Idempotent Stripe webhook ingestion',
      metadata: { source: 'file' },
    },
  },
  decorators: [
    withAppContext({
      submitPlanReview: () => new Promise((resolve) => setTimeout(resolve, 350)),
      autoCloseDelaySeconds: 5,
    }),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Scripted flow used to record the homepage demo video. The play() function shows hover, click, code-token selection, and submit; ends on the post-submit countdown frame. Set window.__demoComplete = true on completion so a Playwright recorder can stop.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    if (window.__skipDemoPlay) {
      window.__demoComplete = true;
      return;
    }
    window.__demoComplete = false;
    const canvas = within(canvasElement);
    const user = userEvent.setup({ delay: 35 });
    const cursor = installFakeCursor();
    cursor.placeAt(window.innerWidth * 0.55, window.innerHeight * 0.85);

    await sleep(900);

    const boldTarget = await canvas.findByText('insert the event row before signature verification');
    await cursor.moveOver(boldTarget);
    await user.hover(boldTarget);
    await sleep(600);
    await user.click(boldTarget);

    const popover = await screen.findByTestId(annotationPopoverTestIds.container);
    const textarea = within(popover).getByTestId(annotationPopoverTestIds.textarea);
    await cursor.moveOver(textarea);
    await user.click(textarea);
    await cursor.hide();
    await user.type(textarea, 'We need to verify the signature before any database write.');
    await sleep(450);
    const saveButton = within(popover).getByTestId(annotationPopoverTestIds.saveButton);
    await cursor.show();
    await cursor.moveOver(saveButton);
    await user.click(saveButton);

    await sleep(700);

    const codeToken = await waitForCodeToken('constructEvent');
    await cursor.moveOver(codeToken);
    await sleep(450);
    selectTextNode(codeToken, 'constructEvent');
    await sleep(350);
    fireMouseUpOnPlan();

    const popover2 = await screen.findByTestId(annotationPopoverTestIds.container);
    const textarea2 = within(popover2).getByTestId(annotationPopoverTestIds.textarea);
    await cursor.moveOver(textarea2);
    await user.click(textarea2);
    await cursor.hide();
    await user.type(textarea2, 'constructEvent throws on bad sigs. Wrap this and return 400.');
    await sleep(450);
    const saveButton2 = within(popover2).getByTestId(annotationPopoverTestIds.saveButton);
    await cursor.show();
    await cursor.moveOver(saveButton2);
    await user.click(saveButton2);

    await sleep(700);

    const submitButton = await canvas.findByTestId(submitBarTestIds.button);
    await cursor.moveOver(submitButton);
    await sleep(250);
    await user.click(submitButton);

    await canvas.findByTestId(submitBarTestIds.countdown);
    await sleep(1600);

    window.__demoComplete = true;
  },
};

const initialDemoPayload = {
  content: demoPlan,
  title: 'Idempotent Stripe webhook ingestion',
  metadata: { source: 'file' as const },
};

const refinedDemoPayload = {
  content: refinedDemoPlan,
  title: 'Idempotent Stripe webhook ingestion',
  metadata: { source: 'file' as const },
};

const AUTO_CLOSE_SECONDS = 1;
const CLOSE_ANIMATION_BUDGET_MS = AUTO_CLOSE_SECONDS * 1000 + 450;

export const FullDemo: Story = {
  args: {
    initialPayload: initialDemoPayload,
  },
  decorators: [
    withAppContext({
      submitPlanReview: () => new Promise((resolve) => setTimeout(resolve, 350)),
      autoCloseDelaySeconds: AUTO_CLOSE_SECONDS,
      closeWindow: () => {
        window.__demoCloseBrowser?.();
      },
      buildInfo: buildInfoFactory.build({ version: '0.2.0' }),
    }),
  ],
  render: (args) => <DemoStage {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Full TUI ↔ PlanBridge lifecycle used to record the homepage demo. Terminal fills the frame; PlanBridge appears as an overlay that animates in on handoff and out on auto-close. play() runs two iterations: feedback → refine → approve → implement.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const term = await waitForTerminal();

    if (window.__skipDemoPlay) {
      dumpLines(term, banner);
      dumpLines(term, planGenerationLines);
      term.writeln(handoffLine);
      dumpLines(term, refiningLines);
      term.writeln(reopenLine);
      dumpLines(term, implementationLines);
      term.writeln(successLine);
      window.__demoInputBox?.setMode('accept');
      window.__demoOpenBrowser?.(initialDemoPayload);
      window.__demoComplete = true;
      return;
    }

    window.__demoComplete = false;

    dumpLines(term, banner);
    await sleep(700);

    await window.__demoInputBox?.type(userPrompt, 14);
    await sleep(450);
    window.__demoInputBox?.clear();
    await sleep(200);

    await streamLines(term, planGenerationLines, 180);
    await sleep(250);
    term.writeln(handoffLine);
    await sleep(500);

    window.__demoOpenBrowser?.(initialDemoPayload);
    await sleep(550);

    const canvas = within(canvasElement);
    const user = userEvent.setup({ delay: 35 });
    const cursor = installFakeCursor();
    cursor.placeAt(window.innerWidth * 0.5, window.innerHeight * 0.85);

    await sleep(400);

    const boldTarget = await canvas.findByText('insert the event row before signature verification');
    await cursor.moveOver(boldTarget);
    await user.hover(boldTarget);
    await sleep(500);
    await user.click(boldTarget);

    const popover = await screen.findByTestId(annotationPopoverTestIds.container);
    const textarea = within(popover).getByTestId(annotationPopoverTestIds.textarea);
    await cursor.moveOver(textarea);
    await user.click(textarea);
    await cursor.hide();
    await user.type(textarea, 'We need to verify the signature before any database write.');
    await sleep(400);
    const saveButton = within(popover).getByTestId(annotationPopoverTestIds.saveButton);
    await cursor.show();
    await cursor.moveOver(saveButton);
    await user.click(saveButton);

    await sleep(500);

    const planScrollerInitial = document.querySelector<HTMLElement>('.demo-plan-scroll');
    await scrollContainer(planScrollerInitial, planScrollerInitial?.scrollHeight ?? 0, 600);
    await sleep(400);

    const codeToken = await waitForCodeToken('constructEvent');
    await cursor.moveOver(codeToken);
    await sleep(400);
    selectTextNode(codeToken, 'constructEvent');
    await sleep(300);
    fireMouseUpOnPlan();

    const popover2 = await screen.findByTestId(annotationPopoverTestIds.container);
    const textarea2 = within(popover2).getByTestId(annotationPopoverTestIds.textarea);
    await cursor.moveOver(textarea2);
    await user.click(textarea2);
    await cursor.hide();
    await user.type(textarea2, 'constructEvent throws on bad sigs. Wrap this and return 400.');
    await sleep(400);
    const saveButton2 = within(popover2).getByTestId(annotationPopoverTestIds.saveButton);
    await cursor.show();
    await cursor.moveOver(saveButton2);
    await user.click(saveButton2);

    await sleep(600);

    const submitButton = await canvas.findByTestId(submitBarTestIds.button);
    await cursor.moveOver(submitButton);
    await sleep(220);
    await user.click(submitButton);

    await canvas.findByTestId(submitBarTestIds.countdown);
    await cursor.hide();
    await sleep(CLOSE_ANIMATION_BUDGET_MS);

    await streamLines(term, refiningLines, 200);
    await sleep(300);
    term.writeln(reopenLine);
    await sleep(500);

    window.__demoOpenBrowser?.(refinedDemoPayload);
    await sleep(550);

    await cursor.show();
    const refinedStep = await canvas.findByText('Verify the Stripe signature first');
    await cursor.moveOver(refinedStep);
    await sleep(700);

    const planScroller = document.querySelector<HTMLElement>('.demo-plan-scroll');
    await scrollContainer(planScroller, 320, 600);
    await sleep(450);

    const approveButton = await canvas.findByTestId(submitBarTestIds.button);
    await cursor.moveOver(approveButton);
    await sleep(450);
    await user.click(approveButton);
    window.__demoInputBox?.setMode('accept');

    await canvas.findByTestId(submitBarTestIds.countdown);
    await cursor.hide();
    await sleep(CLOSE_ANIMATION_BUDGET_MS);

    await streamLines(term, implementationLines, 220);
    await sleep(450);
    term.writeln(successLine);
    await sleep(1100);

    window.__demoComplete = true;
  },
};

async function waitForTerminal(timeoutMs = 5000): Promise<TerminalHandle> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const term = window.__demoTerminal;
    if (term) return term;
    await sleep(50);
  }
  throw new Error('Demo terminal handle did not register on window within timeout');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const CURSOR_TRANSITION_MS = 450;
const CURSOR_FADE_MS = 220;
const CURSOR_TIP_OFFSET_X = 1;
const CURSOR_TIP_OFFSET_Y = 1;

function installFakeCursor() {
  document.getElementById('demo-cursor')?.remove();

  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  cursor.innerHTML = `
    <svg width="22" height="26" viewBox="0 0 22 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2.4 L3 20.6 L7.7 16.2 L10.7 22.4 L13.5 21.2 L10.4 15.0 L16.6 15.0 Z"
            fill="#0a0a0a"
            stroke="#ffffff"
            stroke-width="1.6"
            stroke-linejoin="round"
            stroke-linecap="round"
            paint-order="stroke fill"/>
    </svg>
  `;
  cursor.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    'width: 22px',
    'height: 26px',
    'pointer-events: none',
    'z-index: 99999',
    'opacity: 1',
    'transform: translate(-100px, -100px)',
    `transition: transform ${CURSOR_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${CURSOR_FADE_MS}ms ease`,
    'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
  ].join(';');
  document.body.appendChild(cursor);

  const place = (x: number, y: number) => {
    cursor.style.transform = `translate(${x - CURSOR_TIP_OFFSET_X}px, ${y - CURSOR_TIP_OFFSET_Y}px)`;
  };

  return {
    placeAt(x: number, y: number) {
      place(x, y);
    },
    async moveOver(element: Element) {
      const rect = element.getBoundingClientRect();
      const x = rect.left + Math.min(rect.width * 0.35, 18);
      const y = rect.top + Math.min(rect.height * 0.5, 14);
      place(x, y);
      await sleep(CURSOR_TRANSITION_MS + 80);
    },
    async hide() {
      cursor.style.opacity = '0';
      await sleep(CURSOR_FADE_MS + 30);
    },
    async show() {
      cursor.style.opacity = '1';
      await sleep(CURSOR_FADE_MS + 30);
    },
  };
}

async function waitForCodeToken(needle: string, timeoutMs = 5000): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const codeBlocks = document.querySelectorAll<HTMLElement>('pre code.hljs');
    for (const block of codeBlocks) {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.textContent?.includes(needle)) {
          const parent = node.parentElement;
          if (parent) return parent;
        }
        node = walker.nextNode();
      }
    }
    await sleep(100);
  }
  throw new Error(`Could not find code token containing "${needle}"`);
}

function selectTextNode(parent: HTMLElement, needle: string) {
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const idx = node.textContent?.indexOf(needle) ?? -1;
    if (idx >= 0) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + needle.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    node = walker.nextNode();
  }
  throw new Error(`Could not select "${needle}" inside element`);
}

async function scrollContainer(el: HTMLElement | null, top: number, durationMs: number) {
  if (!el) return;
  const target = el;
  const start = target.scrollTop;
  const delta = top - start;
  const startedAt = performance.now();
  await new Promise<void>((resolve) => {
    function step(now: number) {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      target.scrollTop = start + delta * eased;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

function fireMouseUpOnPlan() {
  const container = document.querySelector(`[data-testid="${markdownPlanTestIds.container}"]`);
  container?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
}
