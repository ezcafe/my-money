/**
 * Workspace Selector Component
 * Dropdown to switch active workspace
 */

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useQuery } from '@apollo/client/react';
import { GET_WORKSPACES } from '../graphql/workspaceOperations';

export interface WorkspaceSelectorProps {
  value?: string;
  onChange: (workspaceId: string) => void;
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
  const { data, loading } = useQuery<{
    workspaces: Array<{
      id: string;
      name: string;
    }>;
  }>(GET_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
  });

  const workspaces = data?.workspaces ?? [];

  return (
    <FormControl fullWidth size="small" disabled={disabled || loading}>
      <InputLabel>Workspace</InputLabel>
      <Select
        value={value ?? ''}
        label="Workspace"
        onChange={(e) => {
          onChange(e.target.value);
        }}
        disabled={disabled || loading}
      >
        {workspaces.map((workspace) => (
          <MenuItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
