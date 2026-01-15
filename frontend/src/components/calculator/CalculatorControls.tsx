/**
 * Calculator Controls Component
 * Menu and action buttons
 */

import React from 'react';
import {Menu, MenuItem, ListItemIcon, ListItemText} from '@mui/material';
import {Assessment, Upload, Settings} from '@mui/icons-material';

interface MenuItemConfig {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface CalculatorControlsProps {
  menuAnchor: HTMLElement | null;
  onMenuClose: () => void;
  onMenuNavigation: (path: string) => void;
}

const menuItems: MenuItemConfig[] = [
  {path: '/report', label: 'Report', icon: <Assessment />},
  {path: '/import', label: 'Import Statement', icon: <Upload />},
  {path: '/preferences', label: 'Preferences', icon: <Settings />},
];

/**
 * Calculator Controls Component
 */
export function CalculatorControls({
  menuAnchor,
  onMenuClose,
  onMenuNavigation,
}: CalculatorControlsProps): React.JSX.Element {
  return (
    <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={onMenuClose}
      >
        {menuItems.map((item) => (
          <MenuItem
            key={item.path}
            onClick={() => {
              onMenuNavigation(item.path);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
    </Menu>
  );
}
