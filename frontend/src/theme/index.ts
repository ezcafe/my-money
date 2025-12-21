/**
 * Theme configuration
 * Uses MUI default theme with dark/light mode support
 */

import {createTheme} from '@mui/material/styles';
import type {Theme} from '@mui/material/styles';
import {getThemeByTime} from './palettes';

/**
 * Create MUI theme with default styles
 * Only sets the mode (dark/light) to use MUI's default palette and styles
 */
export function createAppTheme(mode: 'dark' | 'light' = getThemeByTime()): Theme {
  return createTheme({
    palette: {
      mode,
    },
  });
}

/**
 * Get initial theme based on current time
 */
export function getInitialTheme(): 'dark' | 'light' {
  return getThemeByTime();
}

/**
 * Check if theme should be updated based on time
 * Returns true if theme should change (hour changed and crossed 6 AM or 6 PM)
 */
export function shouldUpdateTheme(lastCheck: Date): boolean {
  const now = new Date();
  const lastHour = lastCheck.getHours();
  const currentHour = now.getHours();

  // Check if we crossed 6 AM or 6 PM
  const wasDark = lastHour >= 18 || lastHour < 6;
  const isDark = currentHour >= 18 || currentHour < 6;

  return wasDark !== isDark;
}


