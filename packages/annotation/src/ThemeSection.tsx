import { SettingsSection } from './SettingsSection.tsx';
import { ThemeOption } from './ThemeOption.tsx';
import type { ThemePreference } from './themes.ts';
import { systemThemeIds, themeById, themes } from './themes.ts';

export const themeSectionTestIds = {
  option: (preference: ThemePreference) => `theme-section-option-${preference}`,
};

export interface ThemeSectionProps {
  readonly preference: ThemePreference;
  readonly onSelect: (preference: ThemePreference) => void;
}

export function ThemeSection({ preference, onSelect }: ThemeSectionProps) {
  return (
    <SettingsSection description="Choose a palette for the review and its code blocks." title="Theme">
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        <ThemeOption
          colors={systemPreviewColors}
          label="System"
          onSelect={onSelect}
          preference="system"
          selected={preference === 'system'}
          testId={themeSectionTestIds.option('system')}
        />
        {themes.map((theme) => (
          <ThemeOption
            key={theme.id}
            colors={theme.preview}
            label={theme.label}
            onSelect={onSelect}
            preference={theme.id}
            selected={preference === theme.id}
            testId={themeSectionTestIds.option(theme.id)}
          />
        ))}
      </div>
    </SettingsSection>
  );
}

const systemLight = themeById.get(systemThemeIds.light)!;
const systemDark = themeById.get(systemThemeIds.dark)!;
const systemPreviewColors = [...systemLight.preview.slice(0, 3), ...systemDark.preview.slice(0, 3)];
