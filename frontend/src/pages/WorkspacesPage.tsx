/**
 * Workspaces Page
 * Lists all workspaces the user belongs to and allows creating new ones
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
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
import { GET_WORKSPACES, DELETE_WORKSPACE } from '../graphql/workspaceOperations';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);

  useEffect(() => {
    setTitle('Workspaces');
    setActionButton({
      icon: <Add />,
      onClick: () => {
        void navigate('/workspaces/add');
      },
      ariaLabel: 'Create Workspace',
    });
    return () => {
      setActionButton(undefined);
    };
  }, [setTitle, setActionButton, navigate]);

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

  const [deleteWorkspace, { loading: deleting }] = useMutation(DELETE_WORKSPACE, {
    refetchQueries: ['GetWorkspaces'],
    onCompleted: () => {
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    },
  });

  const workspaces = data?.workspaces ?? [];

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
                    px: 3,
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
