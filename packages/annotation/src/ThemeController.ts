import { fromThrowable } from 'neverthrow';
import type { ColorScheme, ThemeDefinition, ThemePreference } from './themes.ts';
import { isThemePreference, resolveTheme } from './themes.ts';

const THEME_STORAGE_KEY = 'contextbridge.theme';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeController {
  loadPreference(): ThemePreference;
  savePreference(preference: ThemePreference): void;
  getSystemColorScheme(): ColorScheme;
  subscribeToSystemColorScheme(listener: (colorScheme: ColorScheme) => void): () => void;
  applyTheme(theme: ThemeDefinition): void;
}

export interface ThemeControllerImplOptions {
  readonly storage?: Storage;
  readonly root?: HTMLElement;
  readonly systemThemeQuery?: MediaQueryList;
}

export class ThemeControllerImpl implements ThemeController {
  readonly #storage: Storage;
  readonly #root: HTMLElement;
  readonly #systemThemeQuery: MediaQueryList;

  constructor(options: ThemeControllerImplOptions = {}) {
    const {
      storage = window.localStorage,
      root = document.documentElement,
      systemThemeQuery = window.matchMedia(SYSTEM_DARK_QUERY),
    } = options;
    this.#storage = storage;
    this.#root = root;
    this.#systemThemeQuery = systemThemeQuery;
  }

  loadPreference(): ThemePreference {
    const stored = readStoredPreference(this.#storage).unwrapOr(null);
    return isThemePreference(stored) ? stored : 'system';
  }

  savePreference(preference: ThemePreference): void {
    writeStoredPreference(this.#storage, preference);
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

export function applyInitialTheme(controller: ThemeController): void {
  const preference = controller.loadPreference();
  controller.applyTheme(resolveTheme(preference, controller.getSystemColorScheme()));
}

const readStoredPreference = fromThrowable((storage: Storage) => storage.getItem(THEME_STORAGE_KEY));
const writeStoredPreference = fromThrowable((storage: Storage, preference: ThemePreference) => {
  storage.setItem(THEME_STORAGE_KEY, preference);
});
