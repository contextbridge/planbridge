import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { UpdateOutcome } from '@contextbridge/shared/updateOutcomeSchema';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { withAppContext } from '../.storybook/appContextDecorator.tsx';
import { UpdateNoticeCard } from './UpdateNoticeCard.tsx';

const NOTICE: UpdateNotice = {
  currentVersion: '0.1.0',
  latestVersion: '0.2.0',
  channel: 'stable',
};

const meta: Meta<typeof UpdateNoticeCard> = {
  title: 'Plan/UpdateNoticeCard',
  component: UpdateNoticeCard,
  parameters: { layout: 'padded' },
  decorators: [withAppContext()],
  args: {
    notice: NOTICE,
    onDismiss: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    onUpdate: () => Promise.resolve({ status: 'success' } satisfies UpdateOutcome),
  },
};

export const Updating: Story = {
  args: {
    // Hangs forever so the spinner stays visible in the inspector.
    onUpdate: () => new Promise<UpdateOutcome>(() => {}),
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>(
      '[data-testid="update-notice-card-update"]',
    );
    button?.click();
  },
};

export const FailedRecoverable: Story = {
  args: {
    onUpdate: () =>
      Promise.resolve({
        status: 'failed',
        message: 'Installer failed: brew upgrade exited with code 1.',
        recoverable: true,
      } satisfies UpdateOutcome),
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>(
      '[data-testid="update-notice-card-update"]',
    );
    button?.click();
  },
};

export const FailedUnrecoverable: Story = {
  args: {
    onUpdate: () =>
      Promise.resolve({
        status: 'failed',
        message: 'Updates are disabled for dev builds.',
        recoverable: false,
      } satisfies UpdateOutcome),
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>(
      '[data-testid="update-notice-card-update"]',
    );
    button?.click();
  },
};
