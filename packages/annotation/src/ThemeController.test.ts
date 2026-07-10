import { afterEach, describe, expect, it } from 'vitest';
import { ThemeControllerImpl } from './ThemeController.ts';
import { themeById } from './themes.ts';

describe('ThemeControllerImpl', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('persists and restores an explicit theme preference', () => {
    const controller = new ThemeControllerImpl();

    controller.savePreference('dracula');

    expect(new ThemeControllerImpl().loadPreference()).toBe('dracula');
  });

  it('falls back to System when no valid preference is stored', () => {
    expect(new ThemeControllerImpl().loadPreference()).toBe('system');
  });

  it('applies all semantic colors and dark-mode metadata to the root', () => {
    const root = document.createElement('div');
    const controller = new ThemeControllerImpl({ root });
    const theme = themeById.get('dracula')!;

    controller.applyTheme(theme);

    expect(root).toHaveAttribute('data-theme', 'dracula');
    expect(root).toHaveClass('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(root.style.getPropertyValue('--background')).toBe(theme.styles['--background']);
    expect(root.style.getPropertyValue('--annotation-background')).toBe(theme.styles['--annotation-background']);
  });
});
