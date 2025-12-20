/**
 * Floating Search Box Component
 * Displays a floating search box at the bottom of the page
 */

import React, {useState, type KeyboardEvent} from 'react';
import {Box, Paper, TextField, IconButton, InputAdornment} from '@mui/material';
import {Search as SearchIcon, Close as CloseIcon} from '@mui/icons-material';
import {useSearch} from '../contexts/SearchContext';

/**
 * Floating Search Box Component
 */
export function FloatingSearchBox(): React.JSX.Element {
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
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        p: 2,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 2,
          width: '100%',
          maxWidth: 600,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          backgroundColor: '#ffffff',
          border: '1px solid',
          borderColor: 'divider',
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

