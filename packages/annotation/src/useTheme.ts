import { useEffect, useState } from 'react';
import type { ThemeController } from './ThemeController.ts';
import type { ThemePreference } from './themes.ts';
import { resolveTheme } from './themes.ts';

export function useTheme(controller: ThemeController) {
  const [preference, setPreference] = useState<ThemePreference>(() => controller.loadPreference());
  const [systemColorScheme, setSystemColorScheme] = useState(() => controller.getSystemColorScheme());
  const theme = resolveTheme(preference, systemColorScheme);

  useEffect(() => {
    controller.applyTheme(theme);
  }, [controller, theme]);

  useEffect(() => {
    if (preference !== 'system') return;
    return controller.subscribeToSystemColorScheme(setSystemColorScheme);
  }, [controller, preference]);

  const selectTheme = (nextPreference: ThemePreference) => {
    controller.savePreference(nextPreference);
    if (nextPreference === 'system') {
      setSystemColorScheme(controller.getSystemColorScheme());
    }
    setPreference(nextPreference);
  };

  return {
    preference,
    selectTheme,
    theme,
  };
}
