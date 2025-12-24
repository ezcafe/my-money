/**
 * Color palettes for themes
 */

/**
 * Catppuccin Dark Palette
 * Based on Catppuccin Mocha theme
 */
export const catppuccinDark = {
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  overlay0: '#6c7086',
  overlay1: '#7f849c',
  overlay2: '#9399b2',
  blue: '#89b4fa',
  lavender: '#b4befe',
  sapphire: '#74c7ec',
  sky: '#89dceb',
  teal: '#94e2d5',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  peach: '#fab387',
  maroon: '#eba0ac',
  red: '#f38ba8',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  flamingo: '#f2cdcd',
  rosewater: '#f5e0dc',
};

/**
 * GitHub Light Palette
 * Based on GitHub's light theme
 */
export const githubLight = {
  base: '#ffffff',
  mantle: '#f6f8fa',
  crust: '#ffffff',
  text: '#24292f',
  subtext0: '#57606a',
  subtext1: '#24292f',
  surface0: '#f6f8fa',
  surface1: '#e1e4e8',
  surface2: '#d0d7de',
  overlay0: '#8c959f',
  overlay1: '#6e7781',
  overlay2: '#57606a',
  blue: '#0969da',
  lavender: '#8250df',
  sapphire: '#0969da',
  sky: '#0969da',
  teal: '#1a7f37',
  green: '#1a7f37',
  yellow: '#9a6700',
  peach: '#bf8700',
  maroon: '#cf222e',
  red: '#cf222e',
  mauve: '#8250df',
  pink: '#bf3989',
  flamingo: '#bf3989',
  rosewater: '#cf222e',
};

/**
 * Determine if current time is dark (night) or light (day)
 * Dark theme: 6 PM - 6 AM (18:00 - 06:00)
 * Light theme: 6 AM - 6 PM (06:00 - 18:00)
 */
export function isDarkTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

/**
 * Get theme based on current time
 */
export function getThemeByTime(): 'dark' | 'light' {
  return isDarkTime() ? 'dark' : 'light';
}











