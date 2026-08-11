import type { ThemeController } from '#src/ThemeController.ts';
import type { ColorScheme, ThemeDefinition } from '#src/themes.ts';

export class FakeThemeController implements ThemeController {
  readonly appliedThemes: ThemeDefinition[] = [];

  systemColorScheme: ColorScheme;
  #listeners = new Set<(colorScheme: ColorScheme) => void>();

  constructor(systemColorScheme: ColorScheme = 'light') {
    this.systemColorScheme = systemColorScheme;
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
