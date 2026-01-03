/**
 * Floating Search Box Component
 * Displays a floating search box at the bottom of the page
 */

import React, {useState, type KeyboardEvent} from 'react';
import {Box, Paper, TextField, IconButton, InputAdornment, useTheme} from '@mui/material';
import {Search as SearchIcon, Close as CloseIcon} from '@mui/icons-material';
import {useSearch} from '../contexts/SearchContext';

/**
 * Floating Search Box Component
 */
export function FloatingSearchBox(): React.JSX.Element {
  const theme = useTheme();
  const {isSearchOpen, closeSearch, performSearch} = useSearch();
  const [inputValue, setInputValue] = useState('');

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
        zIndex: 1300,
        p: 2,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : '#ffffff',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none', // Flat style: no shadows
          borderRadius: 0, // Flat style: no rounded corners
        }}
      >
        <TextField
          fullWidth
          placeholder="Search transactions by note..."
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

