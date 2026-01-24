/**
 * Theme Provider Component
 * Provides theme context with M3 color scheme support
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ThemeProvider as MUIThemeProvider, CssBaseline } from '@mui/material';
import { useQuery } from '@apollo/client/react';
import {
  createAppTheme,
  getInitialTheme,
  shouldUpdateTheme,
  type ColorSchemeConfig,
} from './index';
import { GET_PREFERENCES } from '../graphql/queries';
import type { Theme } from '@mui/material/styles';

interface ThemeContextType {
  theme: Theme;
  mode: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (mode: 'dark' | 'light') => void;
  colorScheme: ColorSchemeConfig | undefined;
  updateColorScheme: (scheme: ColorSchemeConfig) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Custom hook to use theme context
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Theme Provider Component
 * Loads color scheme from preferences and applies M3 theme
 */
export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const [mode, setMode] = useState<'dark' | 'light'>(getInitialTheme());
  const [colorScheme, setColorScheme] = useState<ColorSchemeConfig | undefined>(undefined);
  const [theme, setThemeState] = useState<Theme>(createAppTheme(mode));

  // Load preferences to get color scheme
  const { data: preferencesData } = useQuery<{
    preferences?: {
      colorScheme: string | null;
      colorSchemeValue: string | null;
    };
  }>(GET_PREFERENCES, {
    fetchPolicy: 'cache-and-network',
  });

  // Update color scheme from preferences
  useEffect(() => {
    if (preferencesData?.preferences) {
      const scheme: ColorSchemeConfig = {
        type: (preferencesData.preferences.colorScheme as 'dynamic' | 'static' | null) ?? null,
        value: preferencesData.preferences.colorSchemeValue ?? null,
      };
      setColorScheme(scheme);
    }
  }, [preferencesData]);

  // Update theme when mode or color scheme changes
  useEffect(() => {
    setThemeState(createAppTheme(mode, colorScheme));
  }, [mode, colorScheme]);

  // Check for time-based theme updates every hour
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  useEffect(() => {
    const checkTheme = (): void => {
      const now = new Date();
      if (shouldUpdateTheme(lastCheck)) {
        setMode(getInitialTheme());
        setLastCheck(now);
      }
    };

    // Check immediately
    checkTheme();

    // Check every hour
    const interval = setInterval(checkTheme, 60 * 60 * 1000);

    return (): void => {
      clearInterval(interval);
    };
  }, [lastCheck]);

  const toggleTheme = useCallback((): void => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((newMode: 'dark' | 'light'): void => {
    setMode(newMode);
  }, []);

  const updateColorScheme = useCallback((scheme: ColorSchemeConfig): void => {
    setColorScheme(scheme);
  }, []);

  const value: ThemeContextType = {
    theme,
    mode,
    toggleTheme,
    setTheme,
    colorScheme,
    updateColorScheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
}
