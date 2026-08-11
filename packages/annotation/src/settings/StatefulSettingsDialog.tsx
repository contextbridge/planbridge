import { useState } from 'react';
import { SettingsDialog } from './SettingsDialog.tsx';
import type { SettingsDraft } from './settingsDraft.ts';

export interface StatefulSettingsDialogProps {
  readonly initialSettings: SettingsDraft;
}

/** Story-only wrapper that owns the saved-settings state the dialog reads back. */
export function StatefulSettingsDialog({ initialSettings }: StatefulSettingsDialogProps) {
  const [savedSettings, setSavedSettings] = useState(initialSettings);

  return <SettingsDialog onPreviewTheme={() => {}} onSave={setSavedSettings} savedSettings={savedSettings} />;
}
