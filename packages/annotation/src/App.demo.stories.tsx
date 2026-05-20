import { FakeFrontendBrowser } from '@contextbridge/context/testHelpers';
import { buildInfo as buildInfoFactory } from '@contextbridge/context/testFactories';
import type { Meta, StoryObj } from '@storybook/react-vite';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { withAppContext } from '../.storybook/appContextDecorator.tsx';
import { App } from './App.tsx';
import { annotationPopoverTestIds } from './AnnotationPopover.tsx';
import { annotatedMarkdownTestIds } from './AnnotatedMarkdown.tsx';
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
import { dumpLines, streamLines } from './demo/terminalScript.ts';
import type { TerminalHandle } from './demo/TerminalWindow.tsx';

const meta = {
  title: 'Plan/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

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
      contentKind: 'plan',
      title: 'Idempotent Stripe webhook ingestion',
      metadata: { entrypoint: 'plan_command' },
    },
  },
  decorators: [
    withAppContext({
      submitAnnotation: () => new Promise((resolve) => setTimeout(resolve, 350)),
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
  contentKind: 'plan' as const,
  title: 'Idempotent Stripe webhook ingestion',
  metadata: { entrypoint: 'plan_command' as const },
};

const refinedDemoPayload = {
  content: refinedDemoPlan,
  contentKind: 'plan' as const,
  title: 'Idempotent Stripe webhook ingestion',
  metadata: { entrypoint: 'plan_command' as const },
};

const AUTO_CLOSE_SECONDS = 1;
const CLOSE_ANIMATION_BUDGET_MS = AUTO_CLOSE_SECONDS * 1000 + 450;

export const FullDemo: Story = {
  args: {
    initialPayload: initialDemoPayload,
  },
  decorators: [
    withAppContext({
      submitAnnotation: () => new Promise((resolve) => setTimeout(resolve, 350)),
      autoCloseDelaySeconds: AUTO_CLOSE_SECONDS,
      browser: new FakeFrontendBrowser({
        timers: 'real',
        closeWindow: () => {
          window.__demoCloseBrowser?.();
        },
      }),
      buildInfo: buildInfoFactory.build({ version: '0.2.0' }),
    }),
  ],
  render: (args) => <DemoStage {...args} />,
  parameters: {
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
  const container = document.querySelector(`[data-testid="${annotatedMarkdownTestIds.container}"]`);
  container?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
}
