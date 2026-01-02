/**
 * Layout Component
 * Main layout wrapper with transparent toolbar and back button
 */

import React, {useState, useCallback} from 'react';
import {Box, AppBar, Toolbar, IconButton, Typography, Menu, MenuItem} from '@mui/material';
import {ArrowBack, Search as SearchIcon, MoreVert, Edit, Delete} from '@mui/icons-material';
import {useNavigate, useLocation} from 'react-router';
import {useSearch} from '../../contexts/SearchContext';
import {useTitle} from '../../contexts/TitleContext';
import {FloatingSearchBox} from '../FloatingSearchBox';

interface LayoutProps {
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
export function Layout({children, title, hideSearch = false, actionButton, contextMenu}: LayoutProps): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const {openSearch} = useSearch();
  const {title: contextTitle} = useTitle();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // Use context title if available, otherwise fall back to prop title
  const displayTitle = contextTitle ?? title;

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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {!isHomePage && (
        <AppBar
          position="static"
          elevation={1}
        >
          <Toolbar sx={{minHeight: 56}}>
            <IconButton edge="start" color="inherit" onClick={handleBack} aria-label="Back" sx={{mr: 1}}>
              <ArrowBack />
            </IconButton>
            {displayTitle && (
              <Typography variant="h6" component="h1" sx={{flexGrow: 1}}>
                {displayTitle}
              </Typography>
            )}
            {!displayTitle && <Box sx={{flexGrow: 1}} />}
            {!hideSearch && (
              <IconButton edge="end" color="inherit" onClick={handleSearchClick} aria-label="Search" sx={{ml: 1}}>
                <SearchIcon />
              </IconButton>
            )}
            {contextMenu && (
              <IconButton edge="end" color="inherit" onClick={handleContextMenuOpen} aria-label="More options" sx={{ml: 1}}>
                <MoreVert />
              </IconButton>
            )}
            {!contextMenu && actionButton && (
              <IconButton edge="end" color="inherit" onClick={actionButton.onClick} aria-label={actionButton.ariaLabel} sx={{ml: 1}}>
                {actionButton.icon}
              </IconButton>
            )}
          </Toolbar>
        </AppBar>
      )}
      {contextMenu && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleContextMenuClose}
        >
          <MenuItem onClick={handleEdit}>
            <Edit fontSize="small" sx={{mr: 1}} />
            Edit
          </MenuItem>
          <MenuItem onClick={handleDelete} disabled={contextMenu.disableDelete}>
            <Delete fontSize="small" sx={{mr: 1}} />
            Delete
          </MenuItem>
        </Menu>
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: {xs: 2, sm: 3},
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          backgroundColor: 'background.default',
        }}
      >
        {children}
      </Box>
      <FloatingSearchBox />
    </Box>
  );
}

