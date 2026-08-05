import type { ThemeController } from '#src/ThemeController.ts';
import type { ColorScheme, ThemeDefinition, ThemePreference } from '#src/themes.ts';

export class FakeThemeController implements ThemeController {
  readonly appliedThemes: ThemeDefinition[] = [];
  readonly savedPreferences: ThemePreference[] = [];

  preference: ThemePreference;
  systemColorScheme: ColorScheme;
  #listeners = new Set<(colorScheme: ColorScheme) => void>();

  constructor(preference: ThemePreference = 'system', systemColorScheme: ColorScheme = 'light') {
    this.preference = preference;
    this.systemColorScheme = systemColorScheme;
  }

  loadPreference(): ThemePreference {
    return this.preference;
  }

  savePreference(preference: ThemePreference): void {
    this.preference = preference;
    this.savedPreferences.push(preference);
  }

  getSystemColorScheme(): ColorScheme {
    return this.systemColorScheme;
  }

  subscribeToSystemColorScheme(listener: (colorScheme: ColorScheme) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  applyTheme(theme: ThemeDefinition): void {
    this.appliedThemes.push(theme);
  }

  setSystemColorScheme(colorScheme: ColorScheme): void {
    this.systemColorScheme = colorScheme;
    for (const listener of this.#listeners) listener(colorScheme);
  }
}
