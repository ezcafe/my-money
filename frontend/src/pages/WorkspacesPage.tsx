/**
 * Workspaces Page
 * Lists all workspaces the user belongs to, pending invitations, and allows creating new workspaces
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
  Typography,
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client/react';
import { Workspaces, Add, People, Login, MailOutline, PersonAdd } from '@mui/icons-material';
import {
  GET_WORKSPACES,
  GET_MY_PENDING_INVITATIONS,
  DELETE_WORKSPACE,
  ACCEPT_WORKSPACE_INVITATION,
} from '../graphql/workspaceOperations';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
import { PageContainer } from '../components/common/PageContainer';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { useHeader } from '../contexts/HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useDateFormat } from '../hooks/useDateFormat';
import { formatDateShort } from '../utils/formatting';

/** Pending invitation shape from GetMyPendingInvitations */
interface PendingInvitation {
  id: string;
  token: string;
  role: string;
  expiresAt: string;
  workspace: { id: string; name: string };
  inviter: { id: string; email: string };
}

/**
 * Workspaces Page Component
 */
export function WorkspacesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { setTitle, setActionButton } = useHeader();
  const { isAuthenticated } = useAuth();
  const { showSuccessNotification, showErrorNotification } = useNotifications();
  const { dateFormat } = useDateFormat();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<string | null>(null);

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
    skip: isAuthenticated !== true,
  });

  const { data: invitationsData, loading: invitationsLoading } = useQuery<{
    myPendingInvitations: PendingInvitation[];
  }>(GET_MY_PENDING_INVITATIONS, {
    fetchPolicy: 'cache-and-network',
    skip: isAuthenticated !== true,
  });

  const [acceptInvitation] = useMutation(ACCEPT_WORKSPACE_INVITATION, {
    refetchQueries: [{ query: GET_MY_PENDING_INVITATIONS }, { query: GET_WORKSPACES }],
    onCompleted: (data: unknown) => {
      const result = data as {
        acceptWorkspaceInvitation?: { workspace?: { name?: string } };
      };
      const name = result?.acceptWorkspaceInvitation?.workspace?.name;
      if (name) {
        showSuccessNotification(`You joined ${name}`);
      }
      setAcceptingInvitationId(null);
    },
    onError: (err) => {
      showErrorNotification(err.message);
      setAcceptingInvitationId(null);
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
  const pendingInvitations = invitationsData?.myPendingInvitations ?? [];

  const handleAcceptInvitation = async (invitation: PendingInvitation): Promise<void> => {
    setAcceptingInvitationId(invitation.id);
    try {
      await acceptInvitation({
        variables: { token: invitation.token },
      });
    } catch {
      // Error handled in onError
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
      {/* Pending invitations for the current user */}
      {pendingInvitations.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <Box sx={{ p: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MailOutline fontSize="small" color="primary" />
              <Typography variant="h6" component="h2">
                Pending invitations for you
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              You&apos;ve been invited to these workspaces. Click to join.
            </Typography>
          </Box>
          {invitationsLoading ? (
            <Box sx={{ px: 3, pb: 3, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ px: 3, pb: 3 }}>
              <List disablePadding>
                {pendingInvitations.map((invitation, index) => {
                  const isAccepting = acceptingInvitationId === invitation.id;
                  return (
                    <React.Fragment key={invitation.id}>
                      {index > 0 && <Divider />}
                      <ListItemButton
                        onClick={() => {
                          void handleAcceptInvitation(invitation);
                        }}
                        disabled={isAccepting}
                        aria-label={`Accept invitation to ${invitation.workspace.name}`}
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
                          primary={
                            <Typography variant="body1" fontWeight={500}>
                              {invitation.workspace.name}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              Invited by {invitation.inviter.email} • Role: {invitation.role} •
                              Expires {formatDateShort(invitation.expiresAt, dateFormat)}
                            </Typography>
                          }
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            icon={<PersonAdd />}
                            label="Join"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          {isAccepting ? <CircularProgress size={20} sx={{ ml: 0.5 }} /> : null}
                        </Stack>
                      </ListItemButton>
                    </React.Fragment>
                  );
                })}
              </List>
            </Box>
          )}
        </Card>
      )}

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
                    secondaryTypographyProps={{ component: 'div' }}
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
