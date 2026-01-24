/**
 * Workspace Settings Page
 * Manages workspace members, invitations, and settings
 */

import React, { useState } from 'react';
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
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client/react';
import { ArrowBack, PersonAdd, Cancel, PersonRemove } from '@mui/icons-material';
import {
  GET_WORKSPACE,
  GET_WORKSPACE_MEMBERS,
  GET_WORKSPACE_INVITATIONS,
  UPDATE_WORKSPACE_MEMBER_ROLE,
  REMOVE_WORKSPACE_MEMBER,
  CANCEL_WORKSPACE_INVITATION,
} from '../graphql/workspaceOperations';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/common/PageContainer';
import { InviteUserDialog } from '../components/InviteUserDialog';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { formatDateShort } from '../utils/formatting';
import { useDateFormat } from '../hooks/useDateFormat';

type WorkspaceRole = 'Owner' | 'Admin' | 'Member';

/**
 * Workspace Settings Page Component
 */
export function WorkspaceSettingsPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dateFormat } = useDateFormat();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [cancelInvitationDialogOpen, setCancelInvitationDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; email: string } | null>(null);
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(null);

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

  const workspace = workspaceData?.workspace;
  const members = membersData?.workspaceMembers ?? [];
  const invitations = invitationsData?.workspaceInvitations ?? [];

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

  return (
    <PageContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => {
            void navigate('/workspaces');
          }}
        >
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {workspace.name} Settings
        </Typography>
      </Box>

      <Stack spacing={3}>
        {/* Members Section */}
        <Card>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6">Members</Typography>
            <Button
              startIcon={<PersonAdd />}
              onClick={() => {
                setInviteDialogOpen(true);
              }}
            >
              Invite Member
            </Button>
          </Box>

          {members.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No members yet
            </Typography>
          ) : (
            <List disablePadding>
              {members.map((member, index) => (
                <React.Fragment key={member.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      py: 1.5,
                      px: 2,
                    }}
                  >
                    <ListItemText
                      primary={member.user.email}
                      secondary={`Joined ${formatDateShort(member.joinedAt, dateFormat)}`}
                      primaryTypographyProps={{
                        variant: 'body1',
                        fontWeight: 500,
                      }}
                    />
                    <Stack direction="row" spacing={1} alignItems="center">
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
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setMemberToRemove({ id: member.id, email: member.user.email });
                          setRemoveMemberDialogOpen(true);
                        }}
                      >
                        <PersonRemove />
                      </IconButton>
                    </Stack>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </Card>

        {/* Pending Invitations Section */}
        {pendingInvitations.length > 0 && (
          <Card>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Pending Invitations
            </Typography>
            <List disablePadding>
              {pendingInvitations.map((invitation, index) => (
                <React.Fragment key={invitation.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      py: 1.5,
                      px: 2,
                    }}
                  >
                    <ListItemText
                      primary={invitation.email}
                      secondary={`Invited by ${invitation.inviter.email} • Expires ${formatDateShort(invitation.expiresAt, dateFormat)}`}
                      primaryTypographyProps={{
                        variant: 'body1',
                        fontWeight: 500,
                      }}
                    />
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={invitation.role} size="small" variant="outlined" />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setInvitationToCancel(invitation.id);
                          setCancelInvitationDialogOpen(true);
                        }}
                      >
                        <Cancel />
                      </IconButton>
                    </Stack>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        )}
      </Stack>

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
    </PageContainer>
  );
}
