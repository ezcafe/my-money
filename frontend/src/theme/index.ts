/**
 * Theme configuration
 * Uses Material Design 3 design tokens and color schemes
 */

import {createTheme} from '@mui/material/styles';
import type {Theme} from '@mui/material/styles';
import {getThemeByTime} from './palettes';
import {m3Typography, m3Elevation, m3Shape, m3Breakpoints} from './tokens';
import {getColorPalette, type ColorSchemeType} from './colorSchemes';

/**
 * Color scheme configuration
 */
export interface ColorSchemeConfig {
  type: ColorSchemeType;
  value: string | null;
}

/**
 * Create MUI theme with M3 design tokens
 * @param mode - Light or dark mode
 * @param colorScheme - Color scheme configuration
 * @returns MUI theme with M3 styling
 */
export function createAppTheme(
  mode: 'dark' | 'light' = getThemeByTime(),
  colorScheme?: ColorSchemeConfig,
): Theme {
  const palette = getColorPalette(colorScheme?.type ?? null, colorScheme?.value ?? null, mode === 'dark');

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.primary,
        light: palette.primaryContainer,
        dark: palette.primary,
        contrastText: palette.onPrimary,
      },
      secondary: {
        main: palette.secondary,
        light: palette.secondaryContainer,
        dark: palette.secondary,
        contrastText: palette.onSecondary,
      },
      error: {
        main: palette.error,
        light: palette.errorContainer,
        dark: palette.error,
        contrastText: palette.onError,
      },
      background: {
        default: palette.background,
        paper: palette.surface,
      },
      text: {
        primary: palette.onSurface,
        secondary: palette.onSurfaceVariant,
      },
      divider: palette.outlineVariant,
    },
    typography: {
      fontFamily: m3Typography.fontFamily.body,
    },
    spacing: (factor: number) => `${factor * 4}px`, // 4dp grid system
    shape: {
      borderRadius: Number.parseInt(m3Shape.medium, 10),
    },
    shadows: [
      'none',
      m3Elevation[1][mode],
      m3Elevation[2][mode],
      m3Elevation[3][mode],
      m3Elevation[4][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
      m3Elevation[5][mode],
    ] as Theme['shadows'],
    breakpoints: {
      values: m3Breakpoints,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: m3Shape.medium,
            textTransform: 'none',
            fontWeight: m3Typography.fontWeight.medium,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: m3Elevation[1][mode],
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: m3Shape.medium,
            boxShadow: m3Elevation[1][mode],
            backgroundColor: palette.surface,
            color: palette.onSurface,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
            color: palette.onSurface,
          },
          elevation1: {
            boxShadow: m3Elevation[1][mode],
          },
          elevation2: {
            boxShadow: m3Elevation[2][mode],
          },
          elevation3: {
            boxShadow: m3Elevation[3][mode],
          },
          elevation4: {
            boxShadow: m3Elevation[4][mode],
          },
          elevation5: {
            boxShadow: m3Elevation[5][mode],
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: m3Shape.small,
              '& fieldset': {
                borderColor: palette.outline,
              },
              '&:hover fieldset': {
                borderColor: palette.onSurfaceVariant,
              },
              '&.Mui-focused fieldset': {
                borderColor: palette.primary,
              },
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
            color: palette.onSurface,
            boxShadow: m3Elevation[1][mode],
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: m3Shape.small,
            '&:hover': {
              backgroundColor: palette.surfaceVariant,
            },
          },
        },
      },
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


