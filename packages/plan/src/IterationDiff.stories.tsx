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
  },
  decorators: [withAppContext()],
  parameters: {
    docs: {
      description: {
        story:
          'Prototype for the "what changed since last iteration" UX. Pulsing dots in the left gutter mark blocks the assistant updated; the right rail lists one assistant-authored summary per change (with the human feedback that drove it), and removed blocks pin to the top since they have no anchor in the document.',
      },
    },
  },
};
