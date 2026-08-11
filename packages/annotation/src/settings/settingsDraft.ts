import type { ClaudePlanApprovalMode } from '@contextbridge/shared/claudeSettingsSchema';
import type { Settings, SettingsPatch } from '@contextbridge/shared/settingsSchema';
import type { ThemePreference } from '#src/themes.ts';

export interface SettingsDraft {
  readonly theme: ThemePreference;
  readonly claudePlanApprovalMode: ClaudePlanApprovalMode;
}

export function draftFromSettings(settings: Settings): SettingsDraft {
  return {
    theme: settings.ui.theme,
    claudePlanApprovalMode: settings.harnesses.claude.planApprovalMode,
  };
}

/** Builds the sparse patch that carries only the fields the draft changed. */
export function diffSettingsDraft(saved: SettingsDraft, draft: SettingsDraft): SettingsPatch {
  const patch: SettingsPatch = {};
  if (draft.theme !== saved.theme) patch.ui = { theme: draft.theme };
  if (draft.claudePlanApprovalMode !== saved.claudePlanApprovalMode) {
    patch.harnesses = { claude: { planApprovalMode: draft.claudePlanApprovalMode } };
  }
  return patch;
}
