/**
 * Layout Component
 * Main layout wrapper with transparent toolbar and back button
 */

import React, { useState, useCallback, memo } from 'react';
import { Box, AppBar, Toolbar, IconButton, Typography, Menu, MenuItem, Stack } from '@mui/material';
import { ArrowBack, Search as SearchIcon, MoreVert, Edit, Delete } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router';
import { useSearch } from '../../contexts/SearchContext';
import { useHeader, type ActionButton, type ContextMenu } from '../../contexts/HeaderContext';
import { FloatingSearchBox } from '../FloatingSearchBox';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { WorkspaceSelector } from '../WorkspaceSelector';
import { WorkspaceSwitchButton } from '../WorkspaceSwitchButton';

export interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  hideSearch?: boolean;
  actionButton?: ActionButton;
  contextMenu?: ContextMenu;
}

/**
 * Layout Component
 * Provides main app structure with transparent toolbar and back button
 */
function LayoutComponent({
  children,
  title,
  hideSearch = false,
  actionButton,
  contextMenu,
}: LayoutProps): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const { openSearch, closeSearch, isSearchOpen } = useSearch();
  const { title: contextTitle, actionButton: contextActionButton, contextMenu: contextContextMenu } = useHeader();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // Use context values if available, otherwise fall back to prop values
  const displayTitle = contextTitle ?? title;
  const displayActionButton = contextActionButton ?? actionButton;
  const displayContextMenu = contextContextMenu ?? contextMenu;

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'ctrl+k',
      handler: (): void => {
        if (!hideSearch) {
          if (isSearchOpen) {
            closeSearch();
          } else {
            openSearch();
          }
        }
      },
      enabled: !hideSearch,
    },
    {
      key: 'escape',
      handler: (): void => {
        if (isSearchOpen) {
          closeSearch();
        } else if (menuAnchor) {
          setMenuAnchor(null);
        }
      },
    },
  ]);

  /**
   * Handle back button click - navigates to previous page
   */
  const handleBack = (): void => {
    void navigate(-1);
  };

  /**
   * Handle search button click - opens search box
   */
  const handleSearchClick = (): void => {
    openSearch();
  };

  /**
   * Handle context menu open
   */
  const handleContextMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  }, []);

  /**
   * Handle context menu close
   */
  const handleContextMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  /**
   * Handle edit from context menu
   */
  const handleEdit = useCallback(() => {
    if (displayContextMenu?.onEdit) {
      displayContextMenu.onEdit();
      handleContextMenuClose();
    }
  }, [displayContextMenu, handleContextMenuClose]);

  /**
   * Handle delete from context menu
   */
  const handleDelete = useCallback(() => {
    if (displayContextMenu) {
      displayContextMenu.onDelete();
      handleContextMenuClose();
    }
  }, [displayContextMenu, handleContextMenuClose]);

  return (
    <Stack direction="column" sx={{ height: '100vh', overflow: 'hidden' }}>
      {!isHomePage && (
        <AppBar
          position="static"
          elevation={0}
          sx={{
            '@media print': {
              display: 'none',
            },
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleBack}
              aria-label="Back"
              sx={{
                minWidth: { xs: 44, sm: 40 },
                minHeight: { xs: 44, sm: 40 },
              }}
            >
              <ArrowBack />
            </IconButton>
            {displayTitle ? (
              <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
                {displayTitle}
              </Typography>
            ) : null}
            {!displayTitle && <Box sx={{ flexGrow: 1 }} />}
            <Box sx={{ minWidth: 200, mr: 2, display: { xs: 'none', md: 'block' } }}>
              <WorkspaceSelector />
            </Box>
            {!hideSearch && (
              <IconButton
                edge="end"
                color="inherit"
                onClick={handleSearchClick}
                aria-label="Search"
                sx={{
                  minWidth: { xs: 44, sm: 40 },
                  minHeight: { xs: 44, sm: 40 },
                }}
              >
                <SearchIcon />
              </IconButton>
            )}
            {displayContextMenu ? (
              <IconButton
                edge="end"
                color="inherit"
                onClick={handleContextMenuOpen}
                aria-label="More options"
                sx={{
                  minWidth: { xs: 44, sm: 40 },
                  minHeight: { xs: 44, sm: 40 },
                }}
              >
                <MoreVert />
              </IconButton>
            ) : null}
            {!displayContextMenu && displayActionButton ? (
              <IconButton
                edge="end"
                color="inherit"
                onClick={displayActionButton.onClick}
                aria-label={displayActionButton.ariaLabel}
                sx={{
                  minWidth: { xs: 44, sm: 40 },
                  minHeight: { xs: 44, sm: 40 },
                }}
              >
                {displayActionButton.icon}
              </IconButton>
            ) : null}
          </Toolbar>
        </AppBar>
      )}
      {displayContextMenu ? (
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleContextMenuClose}>
          {displayContextMenu.onEdit ? (
            <MenuItem onClick={handleEdit}>
              <Edit fontSize="small" />
              <Box component="span" sx={{ ml: 1 }} />
              Edit
            </MenuItem>
          ) : null}
          <MenuItem onClick={handleDelete} disabled={displayContextMenu.disableDelete}>
            <Delete fontSize="small" />
            <Box component="span" sx={{ ml: 1 }} />
            Delete
          </MenuItem>
        </Menu>
      ) : null}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          overflowY: 'auto',
          animation: 'fadeIn 0.3s ease-in',
          '@keyframes fadeIn': {
            from: {
              opacity: 0,
              transform: 'translateY(8px)',
            },
            to: {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
          // Smooth transitions for state changes
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {children}
      </Box>
      <FloatingSearchBox />
      {isHomePage ? <WorkspaceSwitchButton /> : null}
    </Stack>
  );
}

/**
 * Memoized Layout component to prevent unnecessary re-renders
 */
export const Layout = memo(LayoutComponent);
