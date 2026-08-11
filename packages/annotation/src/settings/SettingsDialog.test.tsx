import { CLAUDE_PLAN_APPROVAL_MODES } from '@contextbridge/shared/claudeSettingsSchema';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settingsDraft } from '#src/testFactories.ts';
import type { ThemePreference } from '#src/themes.ts';
import { claudeCodeSectionCopy, claudeCodeSectionTestIds } from './ClaudeCodeSection.tsx';
import { SettingsDialog, settingsDialogCopy, settingsDialogTestIds } from './SettingsDialog.tsx';
import type { SettingsDraft } from './settingsDraft.ts';
import { themeSectionTestIds } from './ThemeSection.tsx';

describe('SettingsDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders the Theme nav item as current alongside its pane', async () => {
    const { user } = renderSettingsDialog();

    await openDialog(user);

    expect(screen.getByTestId(settingsDialogTestIds.sectionNav('theme'))).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId(themeSectionTestIds.option('system'))).toBeInTheDocument();
  });

  it('previews every selected theme without saving any of them', async () => {
    const { onPreviewTheme, onSave, user } = renderSettingsDialog({ theme: 'nord' });

    await openDialog(user);
    await user.click(screen.getByTestId(themeSectionTestIds.option('dracula')));
    await user.click(screen.getByTestId(themeSectionTestIds.option('tokyo-night')));

    expect(onPreviewTheme.mock.calls).toEqual([['dracula'], ['tokyo-night']]);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves the final draft exactly once when Save is pressed', async () => {
    const { onSave, user } = renderSettingsDialog({ theme: 'nord' });

    await openDialog(user);
    await user.click(screen.getByTestId(themeSectionTestIds.option('dracula')));
    await user.click(screen.getByTestId(themeSectionTestIds.option('tokyo-night')));
    await user.click(screen.getByTestId(settingsDialogTestIds.saveButton));

    expect(onSave).toHaveBeenCalledExactlyOnceWith(settingsDraft.build({ theme: 'tokyo-night' }));
    await waitForDialogToClose();
  });

  it('previews the saved preference again when Cancel is pressed', async () => {
    const { onPreviewTheme, onSave, user } = renderSettingsDialog({ theme: 'nord' });

    await openDialog(user);
    await user.click(screen.getByTestId(themeSectionTestIds.option('dracula')));
    onPreviewTheme.mockClear();

    await user.click(screen.getByTestId(settingsDialogTestIds.cancelButton));

    expect(onPreviewTheme).toHaveBeenCalledExactlyOnceWith('nord');
    expect(onSave).not.toHaveBeenCalled();
    await waitForDialogToClose();
  });

  it('raises the discard confirmation when the close button is used with unsaved changes', async () => {
    const { onPreviewTheme, onSave, user } = renderSettingsDialog({ theme: 'nord' });

    await openDialog(user);
    await user.click(screen.getByTestId(themeSectionTestIds.option('dracula')));
    onPreviewTheme.mockClear();

    await user.click(getDialogCloseButton());

    const discardDialog = await screen.findByTestId(settingsDialogTestIds.discardDialog);
    expect(discardDialog).toHaveTextContent(settingsDialogCopy.discardDialog.title);
    expect(discardDialog).toHaveTextContent(settingsDialogCopy.discardDialog.description);
    expect(screen.getByTestId(settingsDialogTestIds.content)).toBeInTheDocument();
    expect(onPreviewTheme).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('closes on the close button without a confirmation when the draft is clean', async () => {
    const { onPreviewTheme, onSave, user } = renderSettingsDialog({ theme: 'nord' });

    await openDialog(user);
    await user.click(getDialogCloseButton());

    await waitForDialogToClose();
    expect(screen.queryByTestId(settingsDialogTestIds.discardDialog)).not.toBeInTheDocument();
    expect(onPreviewTheme).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('raises the discard confirmation when the overlay is clicked with unsaved changes', async () => {
    const { onSave, user } = renderSettingsDialog({ theme: 'nord' });

    await openDialog(user);
    await user.click(screen.getByTestId(themeSectionTestIds.option('dracula')));

    await user.click(getDialogOverlay());

    expect(await screen.findByTestId(settingsDialogTestIds.discardDialog)).toBeInTheDocument();
    expect(screen.getByTestId(settingsDialogTestIds.content)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps the draft intact when Keep Editing is chosen', async () => {
    const { onPreviewTheme, onSave, user } = renderSettingsDialog({ theme: 'nord' });

    await openDialog(user);
    await user.click(screen.getByTestId(themeSectionTestIds.option('dracula')));
    onPreviewTheme.mockClear();

    await user.keyboard('{Escape}');
    const keepEditing = await screen.findByTestId(settingsDialogTestIds.discardDialogCancelButton);
    expect(keepEditing).toHaveTextContent(settingsDialogCopy.discardDialog.cancelLabel);
    await user.click(keepEditing);

    await waitFor(() => {
      expect(screen.queryByTestId(settingsDialogTestIds.discardDialog)).not.toBeInTheDocument();
    });
    expect(screen.getByTestId(settingsDialogTestIds.content)).toBeInTheDocument();
    expect(screen.getByTestId(themeSectionTestIds.option('dracula'))).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(settingsDialogTestIds.saveButton)).toBeEnabled();
    expect(onPreviewTheme).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('resets the draft to the saved preference when reopened after a discard', async () => {
    const { onPreviewTheme, onSave, user } = renderSettingsDialog({ theme: 'nord' });

    await openDialog(user);
    await user.click(screen.getByTestId(themeSectionTestIds.option('dracula')));
    await user.keyboard('{Escape}');
    await user.click(await screen.findByTestId(settingsDialogTestIds.discardDialogActionButton));
    await waitForDialogToClose();
    onPreviewTheme.mockClear();

    await openDialog(user);

    expect(screen.getByTestId(themeSectionTestIds.option('nord'))).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(themeSectionTestIds.option('dracula'))).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId(settingsDialogTestIds.saveButton)).toBeDisabled();
    expect(onPreviewTheme).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(themeSectionTestIds.option('tokyo-night')));

    expect(onPreviewTheme).toHaveBeenCalledExactlyOnceWith('tokyo-night');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('lists every plan approval mode with the saved one pressed', async () => {
    const { user } = renderSettingsDialog();

    await openDialog(user);
    await openClaudeCodeSection(user);

    for (const mode of CLAUDE_PLAN_APPROVAL_MODES) {
      const option = screen.getByTestId(claudeCodeSectionTestIds.option(mode));
      expect(option).toHaveTextContent(claudeCodeSectionCopy.modes[mode].label);
      expect(option).toHaveAttribute('aria-pressed', String(mode === 'auto'));
    }
  });

  it('saves the selected plan approval mode without previewing a theme', async () => {
    const { onPreviewTheme, onSave, user } = renderSettingsDialog();

    await openDialog(user);
    await openClaudeCodeSection(user);
    expect(screen.getByTestId(settingsDialogTestIds.saveButton)).toBeDisabled();

    await user.click(screen.getByTestId(claudeCodeSectionTestIds.option('default')));

    expect(screen.getByTestId(settingsDialogTestIds.saveButton)).toBeEnabled();
    expect(onPreviewTheme).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(settingsDialogTestIds.saveButton));

    expect(onSave).toHaveBeenCalledExactlyOnceWith(settingsDraft.build({ claudePlanApprovalMode: 'default' }));
    expect(onPreviewTheme).not.toHaveBeenCalled();
    await waitForDialogToClose();
  });

  it('resets a mode-only draft when the discard flow runs', async () => {
    const { onSave, user } = renderSettingsDialog({ claudePlanApprovalMode: 'acceptEdits' });

    await openDialog(user);
    await openClaudeCodeSection(user);
    await user.click(screen.getByTestId(claudeCodeSectionTestIds.option('default')));

    await user.keyboard('{Escape}');
    await user.click(await screen.findByTestId(settingsDialogTestIds.discardDialogActionButton));
    await waitForDialogToClose();

    await openDialog(user);
    await openClaudeCodeSection(user);

    expect(screen.getByTestId(claudeCodeSectionTestIds.option('acceptEdits'))).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(claudeCodeSectionTestIds.option('default'))).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId(settingsDialogTestIds.saveButton)).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

function renderSettingsDialog(savedSettings: Partial<SettingsDraft> = {}) {
  const resolved = settingsDraft.build(savedSettings);
  const onPreviewTheme = vi.fn<(preference: ThemePreference) => void>();
  const onSave = vi.fn<(draft: SettingsDraft) => void>();
  const user = userEvent.setup();
  const result = render(<SettingsDialog onPreviewTheme={onPreviewTheme} onSave={onSave} savedSettings={resolved} />);

  return { onPreviewTheme, onSave, result, user };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId(settingsDialogTestIds.trigger));
  await screen.findByTestId(settingsDialogTestIds.content);
}

async function openClaudeCodeSection(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId(settingsDialogTestIds.sectionNav('claude')));
  await screen.findByTestId(claudeCodeSectionTestIds.option('auto'));
}

async function waitForDialogToClose(): Promise<void> {
  await waitFor(() => {
    expect(screen.queryByTestId(settingsDialogTestIds.content)).not.toBeInTheDocument();
  });
}

function getDialogCloseButton(): HTMLElement {
  return querySlot(screen.getByTestId(settingsDialogTestIds.content), 'dialog-close');
}

function getDialogOverlay(): HTMLElement {
  return querySlot(document.body, 'dialog-overlay');
}

function querySlot(root: ParentNode, slot: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
  if (!element) {
    throw new Error(`Expected a [data-slot="${slot}"] element to be rendered.`);
  }
  return element;
}
