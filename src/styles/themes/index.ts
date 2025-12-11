/**
 * Theme System - Central exports and types
 */

export type ThemeId = 'light' | 'dark' | 'oled' | 'neumorphic';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  className: string;
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'light',
    name: 'Light',
    description: 'Clean, bright interface',
    icon: 'Sun',
    className: 'theme-light',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Grayscale dark mode',
    icon: 'Moon',
    className: 'theme-dark',
  },
  {
    id: 'oled',
    name: 'OLED',
    description: 'Pure black for AMOLED',
    icon: 'Smartphone',
    className: 'theme-oled',
  },
  {
    id: 'neumorphic',
    name: 'Neumorphic',
    description: 'Soft UI with depth',
    icon: 'Layers',
    className: 'theme-neumorphic',
  },
];

export const getThemeConfig = (id: ThemeId): ThemeConfig => {
  return THEMES.find(t => t.id === id) || THEMES[0];
};

export const getNextTheme = (currentId: ThemeId): ThemeId => {
  const currentIndex = THEMES.findIndex(t => t.id === currentId);
  const nextIndex = (currentIndex + 1) % THEMES.length;
  return THEMES[nextIndex].id;
};
