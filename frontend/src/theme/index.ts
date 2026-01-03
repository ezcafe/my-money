/**
 * Theme configuration
 * Uses Material Design 3 design tokens and color schemes
 */

import {createTheme} from '@mui/material/styles';
import type {Theme} from '@mui/material/styles';
import {getThemeByTime} from './palettes';
import {m3Typography, m3Breakpoints, m3Shape, m3Elevation} from './tokens';
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
  const isDark = mode === 'dark';

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
      borderRadius: parseFloat(m3Shape.small), // Default to small (8px) for M3
    },
    shadows: [
      m3Elevation[0][isDark ? 'dark' : 'light'],
      m3Elevation[1][isDark ? 'dark' : 'light'],
      m3Elevation[2][isDark ? 'dark' : 'light'],
      m3Elevation[3][isDark ? 'dark' : 'light'],
      m3Elevation[4][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
      m3Elevation[5][isDark ? 'dark' : 'light'],
    ] as Theme['shadows'],
    breakpoints: {
      values: m3Breakpoints,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: parseFloat(m3Shape.small), // 8px for buttons
            textTransform: 'none',
            fontWeight: m3Typography.fontWeight.medium,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: parseFloat(m3Shape.medium), // 12px for cards
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
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: parseFloat(m3Shape.small), // 8px for text fields
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
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: parseFloat(m3Shape.small), // 8px for list items
            '&:hover': {
              backgroundColor: palette.surfaceVariant,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: parseFloat(m3Shape.full), // Pill shape for chips
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: parseFloat(m3Shape.full), // Pill shape for progress bars
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: parseFloat(m3Shape.large), // 16px for dialogs
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: parseFloat(m3Shape.small), // 8px for menus
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: parseFloat(m3Shape.small), // 8px for popovers
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: parseFloat(m3Shape.small), // 8px for tooltips
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


