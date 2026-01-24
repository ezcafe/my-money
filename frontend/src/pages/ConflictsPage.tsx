/**
 * Conflicts Page
 * Lists all unresolved conflicts for the current workspace
 */

import React, { useState, useCallback } from 'react';
import { Box, Typography, Chip, IconButton, Card, Alert } from '@mui/material';
import { Warning, Refresh, Close } from '@mui/icons-material';
import { useQuery } from '@apollo/client/react';
import { GET_ENTITY_CONFLICTS } from '../graphql/conflictOperations';
import { GET_WORKSPACES } from '../graphql/workspaceOperations';
import { formatDateTime, dateFormatToDateTimeFormat } from '../utils/formatting';
import { useDateFormat } from '../hooks/useDateFormat';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { ConflictResolutionDialog } from '../components/ConflictResolutionDialog';
import { PageContainer } from '../components/common/PageContainer';
import { WorkspaceSelector } from '../components/WorkspaceSelector';

/**
 * Conflicts Page Component
 */
export function ConflictsPage(): React.JSX.Element {
  const { dateFormat } = useDateFormat();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedConflict, setSelectedConflict] = useState<{
    id: string;
    entityType: string;
    entityId: string;
    currentVersion: number;
    incomingVersion: number;
    currentData: Record<string, unknown>;
    incomingData: Record<string, unknown>;
    detectedAt: string;
    workspaceId: string;
  } | null>(null);

  // Get workspaces
  const { data: workspacesData, loading: workspacesLoading } = useQuery<{
    workspaces: Array<{
      id: string;
      name: string;
    }>;
  }>(GET_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
  });

  const workspaces = React.useMemo(
    () => workspacesData?.workspaces ?? [],
    [workspacesData?.workspaces]
  );

  // Auto-select first workspace if available
  React.useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      const firstWorkspace = workspaces[0];
      if (firstWorkspace) {
        setSelectedWorkspaceId(firstWorkspace.id);
      }
    }
  }, [workspaces, selectedWorkspaceId]);

  // Get conflicts for selected workspace
  const { data, loading, error, refetch } = useQuery<{
    entityConflicts: Array<{
      id: string;
      entityType: string;
      entityId: string;
      currentVersion: number;
      incomingVersion: number;
      currentData: Record<string, unknown>;
      incomingData: Record<string, unknown>;
      detectedAt: string;
      workspaceId: string;
    }>;
  }>(GET_ENTITY_CONFLICTS, {
    variables: {
      workspaceId: selectedWorkspaceId,
    },
    skip: !selectedWorkspaceId,
    fetchPolicy: 'cache-and-network',
  });

  const conflicts = data?.entityConflicts ?? [];

  /**
   * Handle conflict click - open resolution dialog
   */
  const handleConflictClick = useCallback(
    (conflict: {
      id: string;
      entityType: string;
      entityId: string;
      currentVersion: number;
      incomingVersion: number;
      currentData: Record<string, unknown>;
      incomingData: Record<string, unknown>;
      detectedAt: string;
      workspaceId: string;
    }) => {
      setSelectedConflict(conflict);
    },
    []
  );

  /**
   * Handle dialog close
   */
  const handleDialogClose = useCallback(() => {
    setSelectedConflict(null);
    void refetch();
  }, [refetch]);

  /**
   * Handle workspace change
   */
  const handleWorkspaceChange = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
  }, []);

  if (workspacesLoading) {
    return (
      <PageContainer>
        <LoadingSpinner message="Loading workspaces..." />
      </PageContainer>
    );
  }

  if (workspaces.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          icon={<Warning />}
          title="No Workspaces"
          description="You need to be a member of at least one workspace to view conflicts."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Workspace Selector */}
        <Card sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" component="h2">
              Workspace
            </Typography>
            <WorkspaceSelector
              value={selectedWorkspaceId}
              onChange={handleWorkspaceChange}
              disabled={workspacesLoading}
            />
            <IconButton
              onClick={() => {
                void refetch();
              }}
              disabled={loading || !selectedWorkspaceId}
              size="small"
            >
              <Refresh />
            </IconButton>
          </Box>
        </Card>

        {/* Conflicts List */}
        {!selectedWorkspaceId ? (
          <Card sx={{ p: 3 }}>
            <Alert severity="info">Please select a workspace to view conflicts.</Alert>
          </Card>
        ) : loading ? (
          <Card sx={{ p: 3 }}>
            <LoadingSpinner message="Loading conflicts..." />
          </Card>
        ) : error ? (
          <Card sx={{ p: 3 }}>
            <ErrorAlert
              title="Error Loading Conflicts"
              message={error?.message ?? 'Failed to load conflicts'}
            />
          </Card>
        ) : conflicts.length === 0 ? (
          <Card sx={{ p: 3 }}>
            <EmptyState
              icon={<Warning />}
              title="No Conflicts"
              description="There are no unresolved conflicts in this workspace."
            />
          </Card>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" component="h2">
                Unresolved Conflicts
              </Typography>
              <Chip
                label={`${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`}
                size="small"
                color="warning"
              />
            </Box>

            {conflicts.map((conflict) => (
              <Card
                key={conflict.id}
                sx={{
                  p: 3,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
                onClick={() => handleConflictClick(conflict)}
              >
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Warning color="warning" />
                      <Typography variant="subtitle1" fontWeight="medium">
                        {conflict.entityType} Conflict
                      </Typography>
                      <Chip
                        label={`v${conflict.currentVersion} vs v${conflict.incomingVersion}`}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Entity ID: {conflict.entityId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Detected:{' '}
                      {formatDateTime(conflict.detectedAt, dateFormatToDateTimeFormat(dateFormat))}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConflictClick(conflict);
                    }}
                  >
                    <Close />
                  </IconButton>
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </Box>

      {/* Conflict Resolution Dialog */}
      {selectedConflict ? (
        <ConflictResolutionDialog
          open={Boolean(selectedConflict)}
          onClose={handleDialogClose}
          conflict={selectedConflict}
          workspaceId={selectedWorkspaceId}
        />
      ) : null}
    </PageContainer>
  );
}
