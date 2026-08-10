import type { ColorScheme, ThemeDefinition, ThemePreference } from './themes.ts';
import { resolveTheme } from './themes.ts';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeController {
  getSystemColorScheme(): ColorScheme;
  subscribeToSystemColorScheme(listener: (colorScheme: ColorScheme) => void): () => void;
  applyTheme(theme: ThemeDefinition): void;
}

export interface ThemeControllerImplOptions {
  readonly root?: HTMLElement;
  readonly systemThemeQuery?: MediaQueryList;
}

export class ThemeControllerImpl implements ThemeController {
  readonly #root: HTMLElement;
  readonly #systemThemeQuery: MediaQueryList;

  constructor(options: ThemeControllerImplOptions = {}) {
    const { root = document.documentElement, systemThemeQuery = window.matchMedia(SYSTEM_DARK_QUERY) } = options;
    this.#root = root;
    this.#systemThemeQuery = systemThemeQuery;
  }

  getSystemColorScheme(): ColorScheme {
    return this.#systemThemeQuery.matches ? 'dark' : 'light';
  }

  subscribeToSystemColorScheme(listener: (colorScheme: ColorScheme) => void): () => void {
    const handleChange = (event: MediaQueryListEvent) => {
      listener(event.matches ? 'dark' : 'light');
    };
    this.#systemThemeQuery.addEventListener('change', handleChange);
    return () => {
      this.#systemThemeQuery.removeEventListener('change', handleChange);
    };
  }

  applyTheme(theme: ThemeDefinition): void {
    this.#root.dataset.theme = theme.id;
    this.#root.classList.toggle('dark', theme.colorScheme === 'dark');
    this.#root.style.colorScheme = theme.colorScheme;
    for (const [property, value] of Object.entries(theme.styles)) {
      this.#root.style.setProperty(property, value);
    }
  }
}

export function applyInitialTheme(controller: ThemeController, preference: ThemePreference): void {
  controller.applyTheme(resolveTheme(preference, controller.getSystemColorScheme()));
}
