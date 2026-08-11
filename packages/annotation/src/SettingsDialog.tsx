import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contextbridge/ui/components/ui/alert-dialog';
import { Button } from '@contextbridge/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@contextbridge/ui/components/ui/dialog';
import { Settings } from 'lucide-react';
import { useState } from 'react';
import { SettingsNavItem } from './SettingsNavItem.tsx';
import type { ThemePreference } from './themes.ts';
import { ThemeSection } from './ThemeSection.tsx';

export const settingsDialogTestIds = {
  trigger: 'settings-dialog-trigger',
  content: 'settings-dialog-content',
  sectionNav: (sectionId: SettingsSectionId) => `settings-dialog-nav-${sectionId}`,
  cancelButton: 'settings-dialog-cancel',
  saveButton: 'settings-dialog-save',
  discardDialog: 'settings-dialog-discard-dialog',
  discardDialogCancelButton: 'settings-dialog-discard-dialog-cancel',
  discardDialogActionButton: 'settings-dialog-discard-dialog-action',
};

export const settingsDialogCopy = {
  discardDialog: {
    title: 'Discard unsaved settings?',
    description: 'Your settings changes have not been saved. If you discard them now they will not be applied.',
    primaryActionLabel: 'Discard',
    cancelLabel: 'Keep Editing',
  },
} as const;

export type SettingsSectionId = 'theme';

export interface SettingsDialogProps {
  readonly savedThemePreference: ThemePreference;
  readonly onPreviewTheme: (preference: ThemePreference) => void;
  readonly onSave: (preference: ThemePreference) => void;
}

export function SettingsDialog({ savedThemePreference, onPreviewTheme, onSave }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<SettingsSectionId>('theme');
  const [draftTheme, setDraftTheme] = useState(savedThemePreference);
  const dirty = draftTheme !== savedThemePreference;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftTheme(savedThemePreference);
      setOpen(true);
      return;
    }

    if (dirty) {
      setDiscardDialogOpen(true);
      return;
    }

    setOpen(false);
  };

  const handleSelectTheme = (preference: ThemePreference) => {
    setDraftTheme(preference);
    onPreviewTheme(preference);
  };

  const handleSave = () => {
    onSave(draftTheme);
    setOpen(false);
  };

  const handleCancel = () => {
    onPreviewTheme(savedThemePreference);
    setOpen(false);
  };

  const handleDiscard = () => {
    onPreviewTheme(savedThemePreference);
    setDiscardDialogOpen(false);
    setOpen(false);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Settings"
          data-testid={settingsDialogTestIds.trigger}
          size="icon-xs"
          title="Settings"
          variant="ghost"
        >
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex h-[min(32rem,85svh)] w-[min(44rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        data-testid={settingsDialogTestIds.content}
      >
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm font-semibold">Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Configure how this review renders. Changes apply when you save.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-border p-2">
            {sections.map((section) => (
              <SettingsNavItem
                key={section.id}
                active={section.id === activeSectionId}
                label={section.label}
                onSelect={() => setActiveSectionId(section.id)}
                testId={settingsDialogTestIds.sectionNav(section.id)}
              />
            ))}
          </nav>
          <div className="flex min-h-0 flex-1 flex-col">
            {renderSection(activeSectionId, { draftTheme, onSelectTheme: handleSelectTheme })}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button data-testid={settingsDialogTestIds.cancelButton} onClick={handleCancel} size="sm" variant="outline">
            Cancel
          </Button>
          <Button data-testid={settingsDialogTestIds.saveButton} disabled={!dirty} onClick={handleSave} size="sm">
            Save
          </Button>
        </div>
        <AlertDialog onOpenChange={setDiscardDialogOpen} open={discardDialogOpen}>
          <AlertDialogContent data-testid={settingsDialogTestIds.discardDialog} size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{settingsDialogCopy.discardDialog.title}</AlertDialogTitle>
              <AlertDialogDescription>{settingsDialogCopy.discardDialog.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid={settingsDialogTestIds.discardDialogCancelButton}>
                {settingsDialogCopy.discardDialog.cancelLabel}
              </AlertDialogCancel>
              <AlertDialogAction
                data-testid={settingsDialogTestIds.discardDialogActionButton}
                onClick={handleDiscard}
                variant="destructive"
              >
                {settingsDialogCopy.discardDialog.primaryActionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

interface SettingsSectionEntry {
  readonly id: SettingsSectionId;
  readonly label: string;
}

const sections: readonly SettingsSectionEntry[] = [{ id: 'theme', label: 'Theme' }];

interface SectionRenderArgs {
  readonly draftTheme: ThemePreference;
  readonly onSelectTheme: (preference: ThemePreference) => void;
}

function renderSection(sectionId: SettingsSectionId, { draftTheme, onSelectTheme }: SectionRenderArgs) {
  switch (sectionId) {
    case 'theme':
      return <ThemeSection onSelect={onSelectTheme} preference={draftTheme} />;
  }
}
