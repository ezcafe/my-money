/**
 * Floating Search Box Component
 * Displays a floating search box at the bottom of the page
 */

import React, {useState, useEffect, useMemo, type KeyboardEvent} from 'react';
import {Box, Paper, TextField, IconButton, InputAdornment, useTheme} from '@mui/material';
import {Search as SearchIcon, Close as CloseIcon} from '@mui/icons-material';
import {useLocation} from 'react-router';
import {useSearch} from '../contexts/SearchContext';

/**
 * Floating Search Box Component
 */
export function FloatingSearchBox(): React.JSX.Element {
  const theme = useTheme();
  const location = useLocation();
  const {isSearchOpen, closeSearch, setSearchQuery, clearSearch, searchQuery} = useSearch();
  const [inputValue, setInputValue] = useState('');

  /**
   * Get placeholder text based on current route
   */
  const placeholder = useMemo(() => {
    if (location.pathname.startsWith('/accounts')) {
      return 'Search accounts by name... (Press Ctrl+K to open)';
    }
    if (location.pathname.startsWith('/categories')) {
      return 'Search categories by name... (Press Ctrl+K to open)';
    }
    if (location.pathname.startsWith('/payees')) {
      return 'Search payees by name... (Press Ctrl+K to open)';
    }
    return 'Search transactions by note... (Press Ctrl+K to open)';
  }, [location.pathname]);

  // Sync input value with search query when search box opens (only on open, not on searchQuery change)
  useEffect(() => {
    if (isSearchOpen) {
      // When search box opens, initialize input with current search query
      // This allows the user to see and continue their previous search
      setInputValue(searchQuery);
    } else {
      // When search box closes, clear input (but don't clear search query)
      setInputValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchOpen]);

  /**
   * Handle search button click - performs search and closes box
   */
  const handleSearch = (): void => {
    if (inputValue.trim()) {
      setSearchQuery(inputValue.trim());
    } else {
      clearSearch();
    }
    closeSearch();
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
   * Handle close button click - only closes the box, doesn't clear search query
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
          placeholder={placeholder}
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

