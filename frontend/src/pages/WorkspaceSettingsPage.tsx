/**
 * Workspace Settings Page
 * Manages workspace members, invitations, and settings
 * Follows Material Design 3 guidelines for spacing, typography, and layout
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Stack,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  PersonAdd,
  Cancel,
  PersonRemove,
  People,
  MailOutline,
  DriveFileRenameOutline,
} from '@mui/icons-material';
import { GET_ME } from '../graphql/queries';
import {
  GET_WORKSPACE,
  GET_WORKSPACE_MEMBERS,
  GET_WORKSPACE_INVITATIONS,
  UPDATE_WORKSPACE_MEMBER_ROLE,
  REMOVE_WORKSPACE_MEMBER,
  CANCEL_WORKSPACE_INVITATION,
  DELETE_WORKSPACE,
} from '../graphql/workspaceOperations';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/common/PageContainer';
import { InviteUserDialog } from '../components/InviteUserDialog';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { formatDateShort } from '../utils/formatting';
import { useDateFormat } from '../hooks/useDateFormat';
import { useHeader } from '../contexts/HeaderContext';

type WorkspaceRole = 'Owner' | 'Admin' | 'Member';

/**
 * Workspace Settings Page Component
 */
export function WorkspaceSettingsPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dateFormat } = useDateFormat();
  const { setTitle, setContextMenu } = useHeader();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [cancelInvitationDialogOpen, setCancelInvitationDialogOpen] = useState(false);
  const [deleteWorkspaceDialogOpen, setDeleteWorkspaceDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; email: string } | null>(null);
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(null);

  const { data: meData } = useQuery<{ me: { id: string } }>(GET_ME, {
    fetchPolicy: 'cache-first',
  });

  const currentUserId = meData?.me?.id;

  const {
    data: workspaceData,
    loading: workspaceLoading,
    error: workspaceError,
  } = useQuery<{
    workspace: {
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    };
  }>(GET_WORKSPACE, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: membersData,
    loading: membersLoading,
    refetch: _refetchMembers,
  } = useQuery<{
    workspaceMembers: Array<{
      id: string;
      userId: string;
      role: WorkspaceRole;
      joinedAt: string;
      user: {
        id: string;
        email: string;
      };
    }>;
  }>(GET_WORKSPACE_MEMBERS, {
    variables: { workspaceId: id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: invitationsData,
    loading: invitationsLoading,
    refetch: refetchInvitations,
  } = useQuery<{
    workspaceInvitations: Array<{
      id: string;
      email: string;
      role: WorkspaceRole;
      expiresAt: string;
      acceptedAt: string | null;
      createdAt: string;
      inviter: {
        id: string;
        email: string;
      };
    }>;
  }>(GET_WORKSPACE_INVITATIONS, {
    variables: { workspaceId: id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });

  const [updateMemberRole, { loading: updatingRole }] = useMutation(UPDATE_WORKSPACE_MEMBER_ROLE, {
    refetchQueries: ['GetWorkspaceMembers'],
  });

  const [removeMember, { loading: removing }] = useMutation(REMOVE_WORKSPACE_MEMBER, {
    refetchQueries: ['GetWorkspaceMembers'],
    onCompleted: () => {
      setRemoveMemberDialogOpen(false);
      setMemberToRemove(null);
    },
  });

  const [cancelInvitation, { loading: canceling }] = useMutation(CANCEL_WORKSPACE_INVITATION, {
    refetchQueries: ['GetWorkspaceInvitations'],
    onCompleted: () => {
      setCancelInvitationDialogOpen(false);
      setInvitationToCancel(null);
    },
  });

  const [deleteWorkspace, { loading: deletingWorkspace }] = useMutation(DELETE_WORKSPACE, {
    refetchQueries: ['GetWorkspaces'],
    onCompleted: () => {
      setDeleteWorkspaceDialogOpen(false);
      void navigate('/workspaces');
    },
  });

  const workspace = workspaceData?.workspace;
  const members = membersData?.workspaceMembers ?? [];
  const invitations = invitationsData?.workspaceInvitations ?? [];

  const currentUserMember = members.find((m) => m.userId === currentUserId);
  const currentUserRole = currentUserMember?.role;
  const canManageMembers = currentUserRole === 'Owner' || currentUserRole === 'Admin';

  useEffect(() => {
    if (workspace) {
      setTitle(`${workspace.name} Settings`);
      setContextMenu(
        currentUserRole === 'Owner'
          ? {
              onDelete: () => {
                setDeleteWorkspaceDialogOpen(true);
              },
            }
          : undefined
      );
    }
    return () => {
      setContextMenu(undefined);
    };
  }, [workspace, currentUserRole, setTitle, setContextMenu]);

  const handleUpdateRole = async (memberId: string, newRole: WorkspaceRole): Promise<void> => {
    if (!id) {
      return;
    }

    try {
      await updateMemberRole({
        variables: {
          workspaceId: id,
          memberId,
          role: newRole,
        },
      });
    } catch {
      // Error handled by mutation
    }
  };

  const handleRemoveMember = async (): Promise<void> => {
    if (!id || !memberToRemove) {
      return;
    }

    try {
      await removeMember({
        variables: {
          workspaceId: id,
          memberId: memberToRemove.id,
        },
      });
    } catch {
      // Error handled by mutation
    }
  };

  const handleCancelInvitation = async (): Promise<void> => {
    if (!invitationToCancel) {
      return;
    }

    try {
      await cancelInvitation({
        variables: {
          invitationId: invitationToCancel,
        },
      });
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteWorkspace = async (): Promise<void> => {
    if (!id) {
      return;
    }

    try {
      await deleteWorkspace({
        variables: {
          id,
        },
      });
    } catch {
      // Error handled by mutation
    }
  };

  if (workspaceLoading || membersLoading || invitationsLoading) {
    return <LoadingSpinner message="Loading workspace settings..." />;
  }

  if (workspaceError || !workspace) {
    return (
      <ErrorAlert
        title="Error Loading Workspace"
        message={workspaceError?.message ?? 'Workspace not found'}
        onRetry={() => {
          void navigate('/workspaces');
        }}
      />
    );
  }

  const pendingInvitations = invitations.filter((inv) => !inv.acceptedAt);
  const canRemoveMembers = members.length > 1;

  return (
    <PageContainer>
      <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
        <Stack spacing={3}>
          {/* Workspace details: name and Rename action */}
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Typography variant="h6" component="h2">
                  {workspace.name}
                </Typography>
                {canManageMembers && id ? (
                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<DriveFileRenameOutline />}
                    onClick={() => {
                      void navigate(`/workspaces/${id}/edit`);
                    }}
                    aria-label="Rename workspace"
                  >
                    Rename
                  </Button>
                ) : null}
              </Box>
            </Box>
          </Card>

          {/* Members Section */}
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 3, pb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  mb: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <People fontSize="small" color="primary" />
                  <Typography variant="h6" component="h2">
                    Members
                  </Typography>
                </Box>
                {canManageMembers ? (
                  <Button
                    variant="contained"
                    size="medium"
                    startIcon={<PersonAdd />}
                    onClick={() => {
                      setInviteDialogOpen(true);
                    }}
                  >
                    Invite Member
                  </Button>
                ) : null}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {canManageMembers
                  ? 'Manage workspace members and their roles. Members can collaborate on accounts, transactions, and budgets.'
                  : 'Only owners and admins can invite members and change roles. You can view the member list and your role.'}
              </Typography>
            </Box>

            {members.length === 0 ? (
              <Box sx={{ px: 3, pb: 3 }}>
                <EmptyState
                  icon={<People />}
                  title="No Members Yet"
                  description="Invite team members to collaborate on this workspace. Members can view and manage accounts, transactions, and budgets based on their role."
                  action={
                    canManageMembers ? (
                      <Button
                        variant="contained"
                        startIcon={<PersonAdd />}
                        onClick={() => {
                          setInviteDialogOpen(true);
                        }}
                      >
                        Invite Member
                      </Button>
                    ) : undefined
                  }
                />
              </Box>
            ) : (
              <Box sx={{ px: 3, pb: 3 }}>
                <List disablePadding>
                  {members.map((member, index) => (
                    <React.Fragment key={member.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          py: 1.5,
                          px: 3,
                          transition: 'background-color 0.2s ease',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            borderRadius: 1,
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight={500}>
                              {member.user.email}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              Joined {formatDateShort(member.joinedAt, dateFormat)}
                            </Typography>
                          }
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {canManageMembers ? (
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                              <InputLabel>Role</InputLabel>
                              <Select
                                value={member.role}
                                label="Role"
                                onChange={(e) => {
                                  void handleUpdateRole(member.id, e.target.value as WorkspaceRole);
                                }}
                                disabled={updatingRole}
                              >
                                <MenuItem value="Member">Member</MenuItem>
                                <MenuItem value="Admin">Admin</MenuItem>
                                <MenuItem value="Owner">Owner</MenuItem>
                              </Select>
                            </FormControl>
                          ) : (
                            <Chip
                              label={member.role}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 500 }}
                            />
                          )}
                          {canManageMembers ? (
                            <Tooltip
                              title={
                                !canRemoveMembers
                                  ? 'Cannot remove the only member'
                                  : 'Remove member'
                              }
                              arrow
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setMemberToRemove({ id: member.id, email: member.user.email });
                                    setRemoveMemberDialogOpen(true);
                                  }}
                                  disabled={!canRemoveMembers}
                                  sx={{
                                    transition: 'background-color 0.2s ease',
                                    '&:hover': {
                                      backgroundColor: 'error.light',
                                      color: 'error.contrastText',
                                    },
                                  }}
                                >
                                  <PersonRemove />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : null}
                        </Stack>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            )}
          </Card>

          {/* Pending Invitations Section */}
          {pendingInvitations.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <Box sx={{ p: 3, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MailOutline fontSize="small" color="primary" />
                  <Typography variant="h6" component="h2">
                    Pending Invitations
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Invitations that are waiting to be accepted. You can cancel them at any time.
                </Typography>
              </Box>
              <Box sx={{ px: 3, pb: 3 }}>
                <List disablePadding>
                  {pendingInvitations.map((invitation, index) => (
                    <React.Fragment key={invitation.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          py: 1.5,
                          px: 3,
                          transition: 'background-color 0.2s ease',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            borderRadius: 1,
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight={500}>
                              {invitation.email}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              Invited by {invitation.inviter.email} • Expires{' '}
                              {formatDateShort(invitation.expiresAt, dateFormat)}
                            </Typography>
                          }
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Chip
                            label={invitation.role}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontWeight: 500,
                            }}
                          />
                          {canManageMembers ? (
                            <Tooltip title="Cancel invitation" arrow>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setInvitationToCancel(invitation.id);
                                  setCancelInvitationDialogOpen(true);
                                }}
                                sx={{
                                  transition: 'background-color 0.2s ease',
                                  '&:hover': {
                                    backgroundColor: 'error.light',
                                    color: 'error.contrastText',
                                  },
                                }}
                              >
                                <Cancel />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                        </Stack>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            </Card>
          )}
        </Stack>
      </Box>

      <InviteUserDialog
        open={inviteDialogOpen}
        workspaceId={id ?? ''}
        onClose={() => {
          setInviteDialogOpen(false);
        }}
        onSuccess={() => {
          void refetchInvitations();
        }}
      />

      <DeleteConfirmDialog
        open={removeMemberDialogOpen}
        onClose={() => {
          setRemoveMemberDialogOpen(false);
          setMemberToRemove(null);
        }}
        onConfirm={handleRemoveMember}
        title="Remove Member"
        message={`Are you sure you want to remove ${memberToRemove?.email} from this workspace?`}
        deleting={removing}
        confirmLabel="Remove"
      />

      <DeleteConfirmDialog
        open={cancelInvitationDialogOpen}
        onClose={() => {
          setCancelInvitationDialogOpen(false);
          setInvitationToCancel(null);
        }}
        onConfirm={handleCancelInvitation}
        title="Cancel Invitation"
        message="Are you sure you want to cancel this invitation?"
        deleting={canceling}
        confirmLabel="Cancel Invitation"
      />

      <DeleteConfirmDialog
        open={deleteWorkspaceDialogOpen}
        onClose={() => {
          setDeleteWorkspaceDialogOpen(false);
        }}
        onConfirm={handleDeleteWorkspace}
        title="Delete Workspace"
        message="Are you sure you want to delete this workspace? This action cannot be undone and will remove all associated data including accounts, transactions, and budgets."
        deleting={deletingWorkspace}
        confirmLabel="Delete Workspace"
      />
    </PageContainer>
  );
}
