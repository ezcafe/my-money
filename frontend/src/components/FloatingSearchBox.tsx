/**
 * Floating Search Box Component
 * Displays a floating search box at the bottom of the page
 */

import React, { useState, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  InputAdornment,
  useTheme,
  List,
  ListItem,
  ListItemButton,
  Typography,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router';
import { useSearch } from '../contexts/SearchContext';

/**
 * Floating Search Box Component
 */
export function FloatingSearchBox(): React.JSX.Element | null {
  const theme = useTheme();
  const location = useLocation();
  const {
    isSearchOpen,
    closeSearch,
    performSearch,
    clearSearch,
    searchQuery,
    suggestions,
    searchHistory,
  } = useSearch();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
  const handleSearch = (query?: string): void => {
    const queryToUse = query ?? inputValue.trim();
    if (queryToUse) {
      performSearch(queryToUse);
    } else {
      clearSearch();
    }
    closeSearch();
    setShowSuggestions(false);
  };

  /**
   * Handle suggestion click
   */
  const handleSuggestionClick = (suggestion: string): void => {
    setInputValue(suggestion);
    handleSearch(suggestion);
  };

  /**
   * Handle keyboard navigation in suggestions
   */
  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && suggestions.length > 0) {
        handleSuggestionClick(suggestions[selectedSuggestionIndex] ?? '');
      } else {
        handleSearch();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setShowSuggestions(true);
      setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  /**
   * Handle input change - show suggestions when typing
   */
  const handleInputChange = (value: string): void => {
    setInputValue(value);
    setShowSuggestions(value.length > 0 || suggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  /**
   * Handle close button click - only closes the box, doesn't clear search query
   */
  const handleClose = (): void => {
    setInputValue('');
    closeSearch();
  };

  if (!isSearchOpen) {
    return null;
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
          backgroundColor:
            theme.palette.mode === 'dark' ? theme.palette.background.paper : '#ffffff',
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
        <Box sx={{ position: 'relative', flex: 1 }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            onFocus={() => setShowSuggestions(inputValue.length > 0 || suggestions.length > 0)}
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
          {/* Suggestions dropdown */}
          {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) ? (
            <Paper
              ref={suggestionsRef}
              elevation={4}
              sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                mt: 1,
                maxHeight: 300,
                overflowY: 'auto',
                zIndex: 1301,
              }}
            >
              <List dense>
                {suggestions.length > 0 ? (
                  <>
                    {suggestions.map((suggestion, index) => (
                      <ListItem key={suggestion} disablePadding>
                        <ListItemButton
                          selected={index === selectedSuggestionIndex}
                          onClick={() => handleSuggestionClick(suggestion)}
                          sx={{
                            minHeight: 40,
                            '&.Mui-selected': {
                              bgcolor: 'action.selected',
                            },
                          }}
                        >
                          <SearchIcon sx={{ mr: 1, fontSize: 20, opacity: 0.6 }} />
                          <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                            {suggestion}
                          </Typography>
                        </ListItemButton>
                      </ListItem>
                    ))}
                    {searchHistory.length > suggestions.length ? <Divider /> : null}
                  </>
                ) : null}
                {searchHistory.length > 0 && inputValue.trim() === '' ? (
                  <>
                    <ListItem>
                      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
                        Recent searches
                      </Typography>
                    </ListItem>
                    {searchHistory.slice(0, 5).map((historyItem, index) => (
                      <ListItem key={`history-${index}`} disablePadding>
                        <ListItemButton
                          onClick={() => handleSuggestionClick(historyItem)}
                          sx={{ minHeight: 40 }}
                        >
                          <HistoryIcon sx={{ mr: 1, fontSize: 20, opacity: 0.6 }} />
                          <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                            {historyItem}
                          </Typography>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </>
                ) : null}
              </List>
            </Paper>
          ) : null}
        </Box>
        <IconButton color="primary" onClick={() => handleSearch()} disabled={!inputValue.trim()}>
          <SearchIcon />
        </IconButton>
        <IconButton onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </Paper>
    </Box>
  );
}
