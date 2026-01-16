/**
 * Layout Component
 * Main layout wrapper with transparent toolbar and back button
 */

import React, {useState, useCallback, memo} from 'react';
import {Box, AppBar, Toolbar, IconButton, Typography, Menu, MenuItem, Stack} from '@mui/material';
import {ArrowBack, Search as SearchIcon, MoreVert, Edit, Delete} from '@mui/icons-material';
import {useNavigate, useLocation} from 'react-router';
import {useSearch} from '../../contexts/SearchContext';
import {useTitle} from '../../contexts/TitleContext';
import {FloatingSearchBox} from '../FloatingSearchBox';
import {useKeyboardShortcuts} from '../../hooks/useKeyboardShortcuts';

export interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  hideSearch?: boolean;
  actionButton?: {
    icon: React.ReactNode;
    onClick: () => void;
    ariaLabel: string;
  };
  contextMenu?: {
    onEdit: () => void;
    onDelete: () => void;
    disableDelete?: boolean;
  };
}

/**
 * Layout Component
 * Provides main app structure with transparent toolbar and back button
 */
function LayoutComponent({children, title, hideSearch = false, actionButton, contextMenu}: LayoutProps): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const {openSearch, closeSearch, isSearchOpen} = useSearch();
  const {title: contextTitle} = useTitle();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // Use context title if available, otherwise fall back to prop title
  const displayTitle = contextTitle ?? title;

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
    if (contextMenu) {
      contextMenu.onEdit();
      handleContextMenuClose();
    }
  }, [contextMenu, handleContextMenuClose]);

  /**
   * Handle delete from context menu
   */
  const handleDelete = useCallback(() => {
    if (contextMenu) {
      contextMenu.onDelete();
      handleContextMenuClose();
    }
  }, [contextMenu, handleContextMenuClose]);

  return (
    <Stack direction="column" sx={{height: '100vh', overflow: 'hidden'}}>
      {!isHomePage && (
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={handleBack} aria-label="Back">
              <ArrowBack />
            </IconButton>
            {displayTitle ? <Typography variant="h6" component="h1" sx={{flexGrow: 1}}>
                {displayTitle}
              </Typography> : null}
            {!displayTitle && <Box sx={{flexGrow: 1}} />}
            {!hideSearch && (
              <IconButton edge="end" color="inherit" onClick={handleSearchClick} aria-label="Search">
                <SearchIcon />
              </IconButton>
            )}
            {contextMenu ? <IconButton edge="end" color="inherit" onClick={handleContextMenuOpen} aria-label="More options">
                <MoreVert />
              </IconButton> : null}
            {!contextMenu && actionButton ? <IconButton edge="end" color="inherit" onClick={actionButton.onClick} aria-label={actionButton.ariaLabel}>
                {actionButton.icon}
              </IconButton> : null}
          </Toolbar>
        </AppBar>
      )}
      {contextMenu ? <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleContextMenuClose}
        >
          <MenuItem onClick={handleEdit}>
            <Edit fontSize="small" />
            <Box component="span" sx={{ml: 1}} />
            Edit
          </MenuItem>
          <MenuItem onClick={handleDelete} disabled={contextMenu.disableDelete}>
            <Delete fontSize="small" />
            <Box component="span" sx={{ml: 1}} />
            Delete
          </MenuItem>
        </Menu> : null}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: {xs: 2, sm: 3},
          overflowY: 'auto',
          animation: 'fadeIn 0.3s ease-in',
          '@keyframes fadeIn': {
            from: {
              opacity: 0,
            },
            to: {
              opacity: 1,
            },
          },
        }}
      >
        {children}
      </Box>
      <FloatingSearchBox />
    </Stack>
  );
}

/**
 * Memoized Layout component to prevent unnecessary re-renders
 */
export const Layout = memo(LayoutComponent);