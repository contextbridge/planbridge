import type { Meta, StoryObj } from '@storybook/react-vite';
import { withAppContext } from '../.storybook/appContextDecorator.tsx';
import { iterationChanges } from './demo/iterationDiff/iterationChanges.ts';
import { IterationDiffStage } from './demo/iterationDiff/IterationDiffStage.tsx';
import { samplePlanV2 } from './demo/iterationDiff/samplePlanV2.ts';

const meta = {
  title: 'Plan/IterationDiff',
  component: IterationDiffStage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof IterationDiffStage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Iteration2WithChanges: Story = {
  args: {
    planContent: samplePlanV2,
    planTitle: 'Refactor auth middleware',
    iterationLabel: 'Iteration 2 of 2',
    changes: iterationChanges,
    commentLayout: 'inline',
  },
  decorators: [withAppContext()],
  parameters: {
    docs: {
      description: {
        story:
          'Prototype for the "what changed since last iteration" UX. Highlighted plan lines mark anchored changes; inline threads read like PR comments with the original human feedback followed by the assistant response. Removed blocks and feedback whose anchor no longer exists fall back to document-level threads in the right rail.',
      },
    },
  },
};

export const Iteration2GoogleDocsComments: Story = {
  args: {
    planContent: samplePlanV2,
    planTitle: 'Refactor auth middleware',
    iterationLabel: 'Iteration 2 of 2',
    changes: iterationChanges,
    commentLayout: 'sidebar',
  },
  decorators: [withAppContext()],
  parameters: {
    docs: {
      description: {
        story:
          'Alternative Google Docs-style iteration review. The plan keeps anchored highlights in the text, every comment thread lives in the right sidebar, N/P moves between assistant responses, and C focuses the reply box for the active thread.',
      },
    },
  },
};
