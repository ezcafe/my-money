/**
 * Layout Component
 * Main layout with navigation
 */

import React from 'react';
import {Box, AppBar, Toolbar, Typography, Button} from '@mui/material';
import {useNavigate, useLocation} from 'react-router';
import {Home, AccountBalance, Assessment, Upload, Schedule, Settings} from '@mui/icons-material';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Layout Component
 * Provides navigation and main app structure
 */
export function Layout({children}: LayoutProps): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {path: '/', label: 'Home', icon: <Home />},
    {path: '/accounts', label: 'Accounts', icon: <AccountBalance />},
    {path: '/report', label: 'Report', icon: <Assessment />},
    {path: '/import', label: 'Import', icon: <Upload />},
    {path: '/schedule', label: 'Schedule', icon: <Schedule />},
    {path: '/preferences', label: 'Settings', icon: <Settings />},
  ];

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', minHeight: '100vh'}}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{flexGrow: 1}}>
            My Money
          </Typography>
          <Box sx={{display: 'flex', gap: 1}}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                color="inherit"
                startIcon={item.icon}
                onClick={(): void => {
                  void navigate(item.path);
                }}
                variant={location.pathname === item.path ? 'outlined' : 'text'}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', minHeight: 0}}>
        {children}
      </Box>
    </Box>
  );
}

