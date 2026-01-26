/**
 * Workspace Switch Button Component
 * Floating circular button that shows budget progress and allows workspace switching
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  useTheme,
} from '@mui/material';
import { Business, Check } from '@mui/icons-material';
import { useQuery } from '@apollo/client/react';
import { GET_WORKSPACES } from '../graphql/workspaceOperations';
import { GET_BUDGETS } from '../graphql/queries';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Workspace Switch Button Component
 * Only renders when user has >= 2 workspaces
 */
export function WorkspaceSwitchButton(): React.JSX.Element | null {
  const theme = useTheme();
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const { isAuthenticated } = useAuth();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // Fetch workspaces
  const { data: workspacesData, loading: workspacesLoading } = useQuery<{
    workspaces: Array<{
      id: string;
      name: string;
    }>;
  }>(GET_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
    skip: isAuthenticated !== true, // Skip query if not authenticated
  });

  // Fetch budgets for current workspace
  const { data: budgetsData, loading: budgetsLoading, refetch: refetchBudgets } = useQuery<{
    budgets: Array<{
      amount: string;
      currentSpent: string;
    }>;
  }>(GET_BUDGETS, {
    fetchPolicy: 'cache-and-network',
    skip: !activeWorkspaceId,
  });

  /**
   * Refetch budgets when workspace changes
   * The cache is cleared in WorkspaceContext, but we explicitly refetch to ensure fresh data
   */
  React.useEffect(() => {
    if (activeWorkspaceId) {
      void refetchBudgets();
    }
  }, [activeWorkspaceId, refetchBudgets]);

  const workspaces = workspacesData?.workspaces ?? [];
  const budgets = useMemo(() => budgetsData?.budgets ?? [], [budgetsData?.budgets]);

  /**
   * Calculate budget progress
   * Returns percentage (0-100) or 5 if no budgets exist
   */
  const progress = useMemo(() => {
    if (budgets.length === 0) {
      return 5; // Default 5% when no budgets
    }

    const totalAmount = budgets.reduce((sum, budget) => {
      return sum + Number(budget.amount);
    }, 0);

    const totalSpent = budgets.reduce((sum, budget) => {
      return sum + Number(budget.currentSpent);
    }, 0);

    if (totalAmount === 0) {
      return 5; // Fallback to 5% if division by zero
    }

    const percentage = (totalSpent / totalAmount) * 100;
    return Math.min(100, Math.max(0, percentage)); // Clamp between 0 and 100
  }, [budgets]);

  /**
   * Handle button click - open menu
   */
  const handleButtonClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  }, []);

  /**
   * Handle menu close
   */
  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  /**
   * Handle workspace selection
   */
  const handleWorkspaceSelect = useCallback(
    (workspaceId: string) => {
      setActiveWorkspaceId(workspaceId || null);
      handleMenuClose();
      // Cache is automatically cleared in WorkspaceContext when activeWorkspaceId changes
      // All queries will refetch with the new workspace ID via X-Workspace-Id header
    },
    [setActiveWorkspaceId, handleMenuClose]
  );

  // Don't render while loading workspaces
  if (workspacesLoading) {
    return null;
  }

  const progressValue = budgetsLoading ? 0 : progress;
  const displayPercentage = budgets.length === 0 ? '' : `${Math.round(progressValue)}%`;

  return (
    <>
      <Fab
        color="primary"
        aria-label="Switch workspace"
        onClick={handleButtonClick}
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: theme.zIndex.appBar + 1,
          width: 56,
          height: 56,
          boxShadow: theme.shadows[4],
          '&:hover': {
            boxShadow: theme.shadows[8],
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Circular progress border using SVG - only show if budgets exist */}
          {budgets.length > 0 ? (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            >
              <svg
                width="56"
                height="56"
                style={{
                  transform: 'rotate(-90deg)',
                }}
              >
                {/* Background circle */}
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke={theme.palette.primary.contrastText}
                  strokeWidth="3"
                  opacity={0.3}
                />
                {/* Progress circle */}
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke={theme.palette.primary.contrastText}
                  strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - progressValue / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
            </Box>
          ) : null}
          {/* Icon and percentage */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Business sx={{ fontSize: 20, mb: displayPercentage ? 0.25 : 0 }} />
            {displayPercentage ? (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  lineHeight: 1,
                  fontWeight: 'bold',
                }}
              >
                {displayPercentage}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </Fab>

      {/* Workspace selection menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {workspaces.map((workspace) => {
          const isSelected = workspace.id === activeWorkspaceId;
          return (
            <MenuItem
              key={workspace.id}
              onClick={() => {
                handleWorkspaceSelect(workspace.id);
              }}
              selected={isSelected}
            >
              {isSelected ? (
                <ListItemIcon>
                  <Check fontSize="small" />
                </ListItemIcon>
              ) : (
                <ListItemIcon />
              )}
              <ListItemText primary={workspace.name} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
