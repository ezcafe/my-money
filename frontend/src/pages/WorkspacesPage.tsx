/**
 * Workspaces Page
 * Lists all workspaces the user belongs to and allows creating new ones
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Chip,
  Stack,
  IconButton,
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client/react';
import { Workspaces, Add, People, Login } from '@mui/icons-material';
import { GET_WORKSPACES, CREATE_WORKSPACE, DELETE_WORKSPACE } from '../graphql/workspaceOperations';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { PageContainer } from '../components/common/PageContainer';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { useHeader } from '../contexts/HeaderContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Workspaces Page Component
 */
export function WorkspacesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { setTitle, setActionButton } = useHeader();
  const { isAuthenticated } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);

  useEffect(() => {
    setTitle('Workspaces');
    setActionButton({
      icon: <Add />,
      onClick: () => {
        setCreateDialogOpen(true);
      },
      ariaLabel: 'Create Workspace',
    });
    return () => {
      setActionButton(undefined);
    };
  }, [setTitle, setActionButton]);

  const { data, loading, error, refetch } = useQuery<{
    workspaces: Array<{
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
      _count: {
        members: number;
        accounts: number;
      };
    }>;
  }>(GET_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
    skip: isAuthenticated !== true, // Skip query if not authenticated
  });

  const [createWorkspace, { loading: creating }] = useMutation(CREATE_WORKSPACE, {
    refetchQueries: ['GetWorkspaces'],
    onCompleted: () => {
      setCreateDialogOpen(false);
      setWorkspaceName('');
    },
  });

  const [deleteWorkspace, { loading: deleting }] = useMutation(DELETE_WORKSPACE, {
    refetchQueries: ['GetWorkspaces'],
    onCompleted: () => {
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    },
  });

  const workspaces = data?.workspaces ?? [];

  const handleCreateWorkspace = async (): Promise<void> => {
    if (!workspaceName.trim()) {
      return;
    }

    try {
      await createWorkspace({
        variables: {
          name: workspaceName.trim(),
        },
      });
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteWorkspace = async (): Promise<void> => {
    if (workspaceToDelete) {
      try {
        await deleteWorkspace({
          variables: {
            id: workspaceToDelete,
          },
        });
      } catch {
        // Error handled by mutation
      }
    }
  };

  if (loading) {
    return <LoadingSpinner useSkeleton skeletonVariant="list" skeletonCount={5} />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Workspaces"
        message={error.message}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <PageContainer>
      {workspaces.length === 0 ? (
        <EmptyState
          icon={<Workspaces />}
          title="No Workspaces Yet"
          description="Create your first workspace to start collaborating with others."
        />
      ) : (
        <Card>
          <List disablePadding>
            {workspaces.map((workspace, index) => (
              <React.Fragment key={workspace.id}>
                {index > 0 && <Divider />}
                <ListItemButton
                  onClick={() => {
                    void navigate(`/workspaces/${workspace.id}/settings`);
                  }}
                  sx={{
                    py: 1.5,
                    px: 2,
                    transition: 'background-color 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <ListItemText
                    primary={workspace.name}
                    secondary={
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip
                          icon={<People />}
                          label={`${workspace._count.members} member${workspace._count.members !== 1 ? 's' : ''}`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`${workspace._count.accounts} account${workspace._count.accounts !== 1 ? 's' : ''}`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    }
                    primaryTypographyProps={{
                      variant: 'body1',
                      fontWeight: 500,
                    }}
                  />
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigate(`/workspaces/${workspace.id}`);
                      }}
                      title="Load Workspace"
                    >
                      <Login />
                    </IconButton>
                  </Stack>
                </ListItemButton>
              </React.Fragment>
            ))}
          </List>
        </Card>
      )}

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setWorkspaceName('');
        }}
        title="Create Workspace"
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => {
                setCreateDialogOpen(false);
                setWorkspaceName('');
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={creating || !workspaceName.trim()}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </Box>
        }
      >
        <TextField
          label="Workspace Name"
          value={workspaceName}
          onChange={(e) => {
            setWorkspaceName(e.target.value);
          }}
          fullWidth
          required
          autoFocus
          placeholder="Enter workspace name"
        />
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setWorkspaceToDelete(null);
        }}
        onConfirm={handleDeleteWorkspace}
        title="Delete Workspace"
        message="Are you sure you want to delete this workspace? This action cannot be undone and will remove all associated data."
        deleting={deleting}
      />
    </PageContainer>
  );
}
