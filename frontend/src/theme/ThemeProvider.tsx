/**
 * Theme Provider Component
 * Provides theme context and time-based theme updates
 */

import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {ThemeProvider as MUIThemeProvider, CssBaseline} from '@mui/material';
import {createAppTheme, getInitialTheme, shouldUpdateTheme} from './index';
import type {Theme} from '@mui/material/styles';

interface ThemeContextType {
  theme: Theme;
  mode: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (mode: 'dark' | 'light') => void;
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
 * Automatically updates theme based on time (6 AM - 6 PM = light, 6 PM - 6 AM = dark)
 */
export function ThemeProvider({children}: ThemeProviderProps): JSX.Element {
  const [mode, setMode] = useState<'dark' | 'light'>(getInitialTheme());
  const [theme, setThemeState] = useState<Theme>(createAppTheme(mode));
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  // Update theme when mode changes
  useEffect(() => {
    setThemeState(createAppTheme(mode));
  }, [mode]);

  // Check for time-based theme updates every hour
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

  const value: ThemeContextType = {
    theme,
    mode,
    toggleTheme,
    setTheme,
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


