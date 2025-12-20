/**
 * Layout Component
 * Main layout wrapper with transparent toolbar and back button
 */

import React from 'react';
import {Box, AppBar, Toolbar, IconButton} from '@mui/material';
import {ArrowBack} from '@mui/icons-material';
import {useNavigate, useLocation} from 'react-router';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Layout Component
 * Provides main app structure with transparent toolbar and back button
 */
export function Layout({children}: LayoutProps): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  /**
   * Handle back button click - navigates to previous page
   */
  const handleBack = (): void => {
    navigate(-1);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        maxWidth: '100vw',
        margin: 0,
        overflow: 'hidden',
      }}
    >
      {!isHomePage && (
        <AppBar
          position="static"
          sx={{
            backgroundColor: 'transparent',
            boxShadow: 'none',
            color: 'inherit',
          }}
        >
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={handleBack} aria-label="Back">
              <ArrowBack />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          width: '100%',
          maxWidth: '100vw',
          margin: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

