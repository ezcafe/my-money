/**
 * Theme configuration
 * Uses MUI theme with Catppuccin dark and GitHub light palettes
 */

import {createTheme} from '@mui/material/styles';
import type {Theme} from '@mui/material/styles';
import {catppuccinDark, githubLight, getThemeByTime} from './palettes';

/**
 * Create MUI theme based on palette
 */
export function createAppTheme(mode: 'dark' | 'light' = getThemeByTime()): Theme {
  const palette = mode === 'dark' ? catppuccinDark : githubLight;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.blue,
        light: mode === 'dark' ? palette.sapphire : palette.sky,
        dark: mode === 'dark' ? palette.blue : palette.blue,
        contrastText: mode === 'dark' ? palette.base : '#ffffff',
      },
      secondary: {
        main: palette.mauve,
        light: palette.pink,
        dark: palette.mauve,
        contrastText: mode === 'dark' ? palette.base : '#ffffff',
      },
      error: {
        main: palette.red,
        light: palette.maroon,
        dark: palette.red,
      },
      warning: {
        main: palette.yellow,
        light: palette.peach,
        dark: palette.yellow,
      },
      info: {
        main: palette.blue,
        light: palette.sapphire,
        dark: palette.blue,
      },
      success: {
        main: palette.green,
        light: palette.teal,
        dark: palette.green,
      },
      background: {
        default: mode === 'dark' ? palette.base : palette.base,
        paper: mode === 'dark' ? palette.mantle : palette.mantle,
      },
      text: {
        primary: palette.text,
        secondary: palette.subtext0,
      },
      divider: mode === 'dark' ? palette.surface0 : palette.surface1,
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: {
        fontSize: '2.5rem',
        fontWeight: 600,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
      },
      body1: {
        fontSize: '1rem',
      },
      body2: {
        fontSize: '0.875rem',
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            border: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            border: 'none',
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            width: '100%',
            maxWidth: '100vw',
            margin: 0,
            padding: 0,
            overflowX: 'hidden',
          },
          body: {
            width: '100%',
            maxWidth: '100vw',
            margin: 0,
            padding: 0,
            overflowX: 'hidden',
          },
          '#root': {
            width: '100%',
            maxWidth: '100vw',
            margin: 0,
            padding: 0,
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


