import type { AnnotationEntrypoint } from '@contextbridge/shared/annotationSchema';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { withAppContext } from '../.storybook/appContextDecorator.tsx';
import { App } from './App.tsx';
import type { AppProps } from './App.tsx';
import { samplePlan } from './demo/samplePlans.ts';

type StoryArgs = AppProps & { source?: AnnotationEntrypoint };

const meta: Meta<StoryArgs> = {
  title: 'Plan/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    source: {
      control: 'select',
      options: ['plan_command', 'hook_claude', 'hook_codex'],
      description: 'Plan source — controls post-submit messaging (e.g. Codex handoff notice)',
    },
  },
};

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
          kind: 'user' as const,
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
    source: 'hook_codex',
    initialPayload: {
      contentKind: 'plan',
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { entrypoint: 'hook_codex' },
    },
  },
  render: ({ source, initialPayload, ...rest }) => (
    <App
      {...rest}
      initialPayload={
        initialPayload
          ? { ...initialPayload, metadata: { entrypoint: source ?? initialPayload.metadata?.entrypoint ?? 'plan_command' } }
          : undefined
      }
    />
  ),
  decorators: [withAppContext({ submitAnnotation: delayedSubmit })],
};

export const SeededReview: Story = {
  args: {
    initialPayload: {
      contentKind: 'plan',
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { entrypoint: 'plan_command' },
    },
    initialThreads: seededThreads,
    initialGlobalComment: seededGlobalComment,
  },
  decorators: [withAppContext({ submitAnnotation: delayedSubmit })],
};

export const OverflowingComments: Story = {
  args: {
    initialPayload: {
      contentKind: 'plan',
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { entrypoint: 'plan_command' },
    },
    initialThreads: overflowingThreads,
  },
  decorators: [withAppContext({ submitAnnotation: delayedSubmit })],
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
    initialPayload: { contentKind: 'plan', content: '', metadata: { entrypoint: 'plan_command' } },
  },
};

export const WithUpdateNoticeStable: Story = {
  args: {
    initialPayload: {
      contentKind: 'plan',
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { entrypoint: 'plan_command' },
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
      contentKind: 'plan',
      content: samplePlan,
      title: 'Refactor auth middleware',
      metadata: { entrypoint: 'plan_command' },
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
