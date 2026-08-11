import { z } from 'zod';

export const THEME_PREFERENCES = [
  'system',
  'github-light-default',
  'ayu-light',
  'everforest-light',
  'catppuccin-latte',
  'github-dark-default',
  'ayu-dark',
  'everforest-dark',
  'dracula',
  'catppuccin-mocha',
  'gruvbox-dark-medium',
  'nord',
  'rose-pine',
  'tokyo-night',
] as const;

export const ThemePreferenceSchema = z.enum(THEME_PREFERENCES);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
