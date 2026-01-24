/**
 * Workspace Selector Component
 * Dropdown to switch active workspace
 */

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useQuery } from '@apollo/client/react';
import { GET_WORKSPACES } from '../graphql/workspaceOperations';

import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';

export interface WorkspaceSelectorProps {
  value?: string;
  onChange?: (workspaceId: string) => void;
  disabled?: boolean;
}

/**
 * Workspace Selector Component
 */
export function WorkspaceSelector({
  value,
  onChange,
  disabled = false,
}: WorkspaceSelectorProps): React.JSX.Element {
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const { isAuthenticated } = useAuth();
  const { data, loading } = useQuery<{
    workspaces: Array<{
      id: string;
      name: string;
    }>;
  }>(GET_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
    skip: isAuthenticated !== true, // Skip query if not authenticated
  });

  const workspaces = data?.workspaces ?? [];

  // Use provided value or active workspace from context
  const selectedValue = value ?? activeWorkspaceId ?? '';

  return (
    <FormControl fullWidth size="small" disabled={disabled || loading}>
      <InputLabel>Workspace</InputLabel>
      <Select
        value={selectedValue}
        label="Workspace"
        onChange={(e) => {
          const newValue = e.target.value;
          if (onChange) {
            onChange(newValue);
          } else {
            setActiveWorkspaceId(newValue || null);
          }
        }}
        disabled={disabled || loading}
      >
        <MenuItem value="">
          <em>None (Personal)</em>
        </MenuItem>
        {workspaces.map((workspace) => (
          <MenuItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
