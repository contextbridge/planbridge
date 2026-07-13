import ayuDark from '@shikijs/themes/ayu-dark';
import ayuLight from '@shikijs/themes/ayu-light';
import catppuccinLatte from '@shikijs/themes/catppuccin-latte';
import catppuccinMocha from '@shikijs/themes/catppuccin-mocha';
import dracula from '@shikijs/themes/dracula';
import everforestDark from '@shikijs/themes/everforest-dark';
import everforestLight from '@shikijs/themes/everforest-light';
import githubDarkDefault from '@shikijs/themes/github-dark-default';
import githubLightDefault from '@shikijs/themes/github-light-default';
import gruvboxDarkMedium from '@shikijs/themes/gruvbox-dark-medium';
import nord from '@shikijs/themes/nord';
import rosePine from '@shikijs/themes/rose-pine';
import tokyoNight from '@shikijs/themes/tokyo-night';
import type { ThemeRegistrationAny } from 'shiki/types';

export type ColorScheme = 'light' | 'dark';

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly label: string;
  readonly colorScheme: ColorScheme;
  readonly preview: readonly string[];
  readonly styles: Readonly<Record<string, string>>;
  readonly shikiTheme: ThemeRegistrationAny;
}

const themeSources = [
  { id: 'github-light-default', label: 'GitHub Light', shikiTheme: githubLightDefault },
  { id: 'ayu-light', label: 'Ayu Light', shikiTheme: ayuLight },
  { id: 'everforest-light', label: 'Everforest Light', shikiTheme: everforestLight },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', shikiTheme: catppuccinLatte },
  { id: 'github-dark-default', label: 'GitHub Dark', shikiTheme: githubDarkDefault },
  { id: 'ayu-dark', label: 'Ayu Dark', shikiTheme: ayuDark },
  { id: 'everforest-dark', label: 'Everforest Dark', shikiTheme: everforestDark },
  { id: 'dracula', label: 'Dracula', shikiTheme: dracula },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', shikiTheme: catppuccinMocha },
  { id: 'gruvbox-dark-medium', label: 'Gruvbox Dark', shikiTheme: gruvboxDarkMedium },
  { id: 'nord', label: 'Nord', shikiTheme: nord },
  { id: 'rose-pine', label: 'Rosé Pine', shikiTheme: rosePine },
  { id: 'tokyo-night', label: 'Tokyo Night', shikiTheme: tokyoNight },
] as const;

export type ThemeId = (typeof themeSources)[number]['id'];
export type ThemePreference = ThemeId | 'system';

export const themes: readonly ThemeDefinition[] = themeSources.map(({ id, label, shikiTheme }) =>
  createThemeDefinition(id, label, shikiTheme),
);

export const shikiThemes: readonly ThemeRegistrationAny[] = themes.map(({ shikiTheme }) => shikiTheme);

export const systemThemeIds = {
  light: 'github-light-default',
  dark: 'github-dark-default',
} as const satisfies Record<ColorScheme, ThemeId>;

export const themeById = new Map(themes.map((theme) => [theme.id, theme]));

export function resolveTheme(preference: ThemePreference, systemColorScheme: ColorScheme): ThemeDefinition {
  const id = preference === 'system' ? systemThemeIds[systemColorScheme] : preference;
  return themeById.get(id) ?? themeById.get(systemThemeIds[systemColorScheme])!;
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || (value !== null && themeById.has(value as ThemeId));
}

function createThemeDefinition(id: ThemeId, label: string, shikiTheme: ThemeRegistrationAny): ThemeDefinition {
  const colors = shikiTheme.colors ?? {};
  const colorScheme: ColorScheme = shikiTheme.type === 'light' ? 'light' : 'dark';
  const background = pickColor(colors, ['editor.background'], colorScheme === 'light' ? '#ffffff' : '#0d1117');
  const foreground = pickColor(colors, ['editor.foreground'], colorScheme === 'light' ? '#1f2328' : '#f0f6fc');
  const surface = pickColor(colors, ['sideBar.background', 'editorWidget.background', 'panel.background'], background);
  const muted = pickColor(
    colors,
    ['editorGroupHeader.tabsBackground', 'input.background', 'dropdown.background', 'sideBar.background'],
    surface,
  );
  const mutedForeground = pickColor(
    colors,
    ['descriptionForeground', 'sideBar.foreground', 'editorLineNumber.foreground'],
    foreground,
  );
  const border = pickColor(
    colors,
    ['panel.border', 'sideBar.border', 'editorGroup.border', 'input.border', 'contrastBorder'],
    mutedForeground,
  );
  const primary = pickColor(
    colors,
    ['textLink.foreground', 'activityBarBadge.background', 'button.background', 'focusBorder'],
    foreground,
  );
  const primaryForeground = bestContrastingColor(primary, background, foreground);
  const accent = pickColor(
    colors,
    ['list.hoverBackground', 'list.activeSelectionBackground', 'editor.selectionBackground'],
    muted,
  );
  const accentForeground = pickColor(
    colors,
    ['list.hoverForeground', 'list.activeSelectionForeground', 'editor.selectionForeground'],
    foreground,
  );
  const destructive = pickColor(colors, ['errorForeground', 'editorError.foreground', 'terminal.ansiRed'], '#ef4444');
  const warning = pickColor(colors, ['editorWarning.foreground', 'terminal.ansiYellow'], '#f59e0b');
  const green = pickColor(colors, ['terminal.ansiGreen', 'testing.iconPassed'], primary);
  const violet = pickColor(colors, ['terminal.ansiMagenta', 'symbolIcon.typeParameterForeground'], primary);
  const cyan = pickColor(colors, ['terminal.ansiCyan', 'terminal.ansiBrightBlue'], primary);
  const annotation = pickColor(
    colors,
    ['editor.findMatchBackground', 'editor.selectionBackground', 'editor.wordHighlightStrongBackground'],
    warning,
  );
  const annotationActive = pickColor(
    colors,
    ['editor.findMatchHighlightBackground', 'editor.selectionHighlightBackground'],
    annotation,
  );
  const annotationForeground = bestContrastingColor(annotation, background, foreground);

  return {
    id,
    label,
    colorScheme,
    shikiTheme,
    preview: [background, surface, primary, annotation, green, violet],
    styles: {
      '--background': background,
      '--foreground': foreground,
      '--muted-foreground': mutedForeground,
      '--border': border,
      '--card': surface,
      '--card-foreground': foreground,
      '--primary': primary,
      '--primary-foreground': primaryForeground,
      '--secondary': muted,
      '--secondary-foreground': foreground,
      '--accent': accent,
      '--accent-foreground': accentForeground,
      '--muted': muted,
      '--popover': surface,
      '--popover-foreground': foreground,
      '--destructive': destructive,
      '--input': border,
      '--ring': primary,
      '--chart-1': warning,
      '--chart-2': green,
      '--chart-3': primary,
      '--chart-4': violet,
      '--chart-5': destructive,
      '--sidebar': surface,
      '--sidebar-foreground': foreground,
      '--sidebar-primary': primary,
      '--sidebar-primary-foreground': primaryForeground,
      '--sidebar-accent': accent,
      '--sidebar-accent-foreground': accentForeground,
      '--sidebar-border': border,
      '--sidebar-ring': primary,
      '--annotation-background': annotation,
      '--annotation-active-background': annotationActive,
      '--annotation-foreground': annotationForeground,
      '--annotation-border': warning,
      '--annotation-hover': cyan,
      '--code-background': background,
      '--code-foreground': foreground,
    },
  };
}

function bestContrastingColor(background: string, first: string, second: string): string {
  return contrastRatio(background, first) >= contrastRatio(background, second) ? first : second;
}

function contrastRatio(first: string, second: string): number {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(color: string): number {
  const hex = color.match(/^#([\da-f]{6})/i)?.[1];
  if (!hex) return 0;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function pickColor(colors: Record<string, string>, keys: readonly string[], fallback: string): string {
  for (const key of keys) {
    const color = colors[key];
    if (color) return color;
  }
  return fallback;
}
