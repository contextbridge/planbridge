import { describe, expect, it } from 'vitest';
import { FakeThemeController } from './testHelpers/FakeThemeController.ts';
import { ThemeControllerImpl, applyInitialTheme } from './ThemeController.ts';
import { themeById } from './themes.ts';

describe('ThemeControllerImpl', () => {
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

describe('applyInitialTheme', () => {
  it('applies an explicit preference directly', () => {
    const controller = new FakeThemeController('light');

    applyInitialTheme(controller, 'dracula');

    expect(controller.appliedThemes.at(-1)?.id).toBe('dracula');
  });

  it('resolves the system preference against the current color scheme', () => {
    const controller = new FakeThemeController('dark');

    applyInitialTheme(controller, 'system');

    expect(controller.appliedThemes.at(-1)?.id).toBe('github-dark-default');
  });
});
