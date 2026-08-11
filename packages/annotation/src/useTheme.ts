import { useEffect, useState } from 'react';
import type { ThemeController } from './ThemeController.ts';
import type { ThemePreference } from './themes.ts';
import { resolveTheme } from './themes.ts';

export interface UseThemeOptions {
  readonly initialPreference: ThemePreference;
}

export function useTheme(controller: ThemeController, options: UseThemeOptions) {
  const { initialPreference } = options;
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);
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
