import type { Meta, StoryObj } from '@storybook/react-vite';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { claudeCodeSectionTestIds } from './ClaudeCodeSection.tsx';
import { SettingsDialog, settingsDialogTestIds } from './SettingsDialog.tsx';
import { StatefulSettingsDialog } from './StatefulSettingsDialog.tsx';
import { themeSectionTestIds } from './ThemeSection.tsx';

const meta = {
  title: 'Plan/SettingsDialog',
  component: SettingsDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    savedSettings: { theme: 'system', claudePlanApprovalMode: 'auto' },
    onPreviewTheme: () => {},
    onSave: () => {},
  },
  render: ({ savedSettings }) => <StatefulSettingsDialog initialSettings={savedSettings} />,
} satisfies Meta<typeof SettingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Opened: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Opens the modal so the full settings panel is captured: section sidebar on the left, the active section pane on the right, and the Cancel / Save footer.',
      },
    },
  },
  play: async () => {
    const user = userEvent.setup();

    await user.click(screen.getByTestId(settingsDialogTestIds.trigger));
    await screen.findByTestId(settingsDialogTestIds.content);
  },
};

export const UnsavedChangesWarning: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Dismissing the dialog with an unsaved theme change raises the discard confirmation.',
      },
    },
  },
  play: async () => {
    const user = userEvent.setup();

    await user.click(screen.getByTestId(settingsDialogTestIds.trigger));
    await user.click(await screen.findByTestId(themeSectionTestIds.option('dracula')));
    await user.keyboard('{Escape}');
    await screen.findByTestId(settingsDialogTestIds.discardDialog);
  },
};

export const ClaudeCodeSectionOpened: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The Claude Code pane, listing every permission mode a plan approval can hand back to Claude Code.',
      },
    },
  },
  play: async () => {
    const user = userEvent.setup();

    await user.click(screen.getByTestId(settingsDialogTestIds.trigger));
    await user.click(await screen.findByTestId(settingsDialogTestIds.sectionNav('claude')));
    await screen.findByTestId(claudeCodeSectionTestIds.option('auto'));
  },
};
