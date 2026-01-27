/**
 * Workspace Selector Component
 * Dropdown to switch active workspace
 */

import React, { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_WORKSPACES } from '../graphql/workspaceOperations';
import { MobileSelect } from './ui/MobileSelect';
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

  // Use provided value or active workspace from context
  const selectedValue = value ?? activeWorkspaceId ?? '';

  // Memoize workspaces to prevent unnecessary re-renders
  const workspaces = useMemo(() => data?.workspaces ?? [], [data?.workspaces]);

  // Create options array (without "None (Personal)" option)
  const options = useMemo(() => {
    return workspaces.map((w) => ({ id: w.id, name: w.name }));
  }, [workspaces]);

  // Find selected workspace
  const selectedWorkspace = useMemo(() => {
    return options.find((opt) => opt.id === selectedValue) ?? null;
  }, [options, selectedValue]);

  return (
    <MobileSelect<{ id: string; name: string }>
      value={selectedWorkspace}
      options={options}
      onChange={(workspace) => {
        const newValue = workspace?.id ?? '';
        if (onChange) {
          onChange(newValue);
        } else {
          setActiveWorkspaceId(newValue || null);
        }
      }}
      getOptionLabel={(option) => option.name}
      getOptionId={(option) => option.id}
      label="Workspace"
      disabled={disabled || loading}
      size="small"
    />
  );
}
