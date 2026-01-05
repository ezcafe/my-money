/**
 * Floating Search Box Component
 * Displays a floating search box at the bottom of the page
 */

import React, {useState, useEffect, useCallback, useMemo, type KeyboardEvent} from 'react';
import {Box, Paper, TextField, IconButton, InputAdornment, useTheme} from '@mui/material';
import {Search as SearchIcon, Close as CloseIcon} from '@mui/icons-material';
import {useSearch} from '../contexts/SearchContext';
import {debounce} from '../utils/rateLimiting';

/**
 * Floating Search Box Component
 */
export function FloatingSearchBox(): React.JSX.Element {
  const theme = useTheme();
  const {isSearchOpen, closeSearch, performSearch} = useSearch();
  const [inputValue, setInputValue] = useState('');

  // Debounced search function (300ms delay)
  const debouncedSearch = useCallback(
    (query: string): void => {
      if (query.trim()) {
        performSearch(query.trim());
      }
    },
    [performSearch],
  );

  const debouncedSearchFn = useMemo(
    () => debounce(debouncedSearch as (...args: unknown[]) => unknown, 300) as (query: string) => void,
    [debouncedSearch],
  );

  // Trigger debounced search when input changes
  useEffect(() => {
    if (inputValue.trim()) {
      debouncedSearchFn(inputValue);
    }
  }, [inputValue, debouncedSearchFn]);

  /**
   * Handle search button click
   */
  const handleSearch = (): void => {
    if (inputValue.trim()) {
      performSearch(inputValue.trim());
      setInputValue('');
    }
  };

  /**
   * Handle Enter key press
   */
  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  /**
   * Handle close button click
   */
  const handleClose = (): void => {
    setInputValue('');
    closeSearch();
  };

  if (!isSearchOpen) {
    return <></>;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        p: 2,
        display: 'flex',
        justifyContent: 'center',
        animation: 'slideUp 0.3s ease-out',
        '@keyframes slideUp': {
          from: {
            transform: 'translateY(100%)',
            opacity: 0,
          },
          to: {
            transform: 'translateY(0)',
            opacity: 1,
          },
        },
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 2,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : '#ffffff',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          maxWidth: 600,
          width: '100%',
          transition: 'box-shadow 0.2s ease',
          '&:focus-within': {
            boxShadow: theme.shadows[8],
          },
        }}
      >
        <TextField
          fullWidth
          placeholder="Search transactions by note... (Press Ctrl+K to open)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              transition: 'all 0.2s ease',
            },
          }}
        />
        <IconButton color="primary" onClick={handleSearch} disabled={!inputValue.trim()}>
          <SearchIcon />
        </IconButton>
        <IconButton onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </Paper>
    </Box>
  );
}

