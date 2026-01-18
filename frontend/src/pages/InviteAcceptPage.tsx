/**
 * Invite Accept Page
 * Allows users to accept workspace invitations via token
 */

import React, {useEffect, useState} from 'react';
import {useSearchParams, useNavigate} from 'react-router';
import {Box, Typography, Stack, CircularProgress} from '@mui/material';
import {useQuery, useMutation} from '@apollo/client/react';
import {CheckCircle, Error as ErrorIcon} from '@mui/icons-material';
import {GET_INVITATION_BY_TOKEN, ACCEPT_WORKSPACE_INVITATION} from '../graphql/workspaceOperations';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {PageContainer} from '../components/common/PageContainer';
import {formatDateShort} from '../utils/formatting';
import {useDateFormat} from '../hooks/useDateFormat';

/**
 * Invite Accept Page Component
 */
export function InviteAcceptPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {dateFormat} = useDateFormat();
  const token = searchParams.get('token');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {data, loading, error: queryError} = useQuery<{
    invitationByToken: {
      id: string;
      email: string;
      role: string;
      expiresAt: string;
      acceptedAt: string | null;
      workspace: {
        id: string;
        name: string;
      };
      inviter: {
        id: string;
        email: string;
      };
    };
  }>(GET_INVITATION_BY_TOKEN, {
    variables: {token: token ?? ''},
    skip: !token,
    fetchPolicy: 'network-only',
  });

  const [acceptInvitation, {loading: accepting}] = useMutation(ACCEPT_WORKSPACE_INVITATION, {
    onCompleted: () => {
      setAccepted(true);
      setTimeout(() => {
        void navigate('/workspaces');
      }, 2000);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const invitation = data?.invitationByToken;

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Missing token.');
    }
  }, [token]);

  const handleAccept = async (): Promise<void> => {
    if (!token) {
      return;
    }

    try {
      await acceptInvitation({
        variables: {
          token,
        },
      });
    } catch {
      // Error handled by mutation
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading invitation..." />;
  }

  if (queryError || !invitation || error) {
    return (
      <PageContainer>
        <Card>
          <Stack spacing={2} alignItems="center" sx={{py: 4}}>
            <ErrorIcon color="error" sx={{fontSize: 48}} />
            <Typography variant="h6" color="error">
              {error ?? queryError?.message ?? 'Invalid Invitation'}
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              This invitation link is invalid or has expired. Please contact the workspace owner for a new invitation.
            </Typography>
            <Button
              onClick={() => {
                void navigate('/workspaces');
              }}
            >
              Go to Workspaces
            </Button>
          </Stack>
        </Card>
      </PageContainer>
    );
  }

  if (invitation.acceptedAt) {
    return (
      <PageContainer>
        <Card>
          <Stack spacing={2} alignItems="center" sx={{py: 4}}>
            <CheckCircle color="success" sx={{fontSize: 48}} />
            <Typography variant="h6">Invitation Already Accepted</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              This invitation has already been accepted. You can access the workspace from your workspaces page.
            </Typography>
            <Button
              onClick={() => {
                void navigate('/workspaces');
              }}
            >
              Go to Workspaces
            </Button>
          </Stack>
        </Card>
      </PageContainer>
    );
  }

  const isExpired = new Date(invitation.expiresAt) < new Date();

  if (isExpired) {
    return (
      <PageContainer>
        <Card>
          <Stack spacing={2} alignItems="center" sx={{py: 4}}>
            <ErrorIcon color="error" sx={{fontSize: 48}} />
            <Typography variant="h6" color="error">
              Invitation Expired
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              This invitation expired on {formatDateShort(invitation.expiresAt, dateFormat)}. Please contact the workspace owner for a new invitation.
            </Typography>
            <Button
              onClick={() => {
                void navigate('/workspaces');
              }}
            >
              Go to Workspaces
            </Button>
          </Stack>
        </Card>
      </PageContainer>
    );
  }

  if (accepted) {
    return (
      <PageContainer>
        <Card>
          <Stack spacing={2} alignItems="center" sx={{py: 4}}>
            <CheckCircle color="success" sx={{fontSize: 48}} />
            <Typography variant="h6">Invitation Accepted!</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              You have successfully joined {invitation.workspace.name}. Redirecting to workspaces...
            </Typography>
            <CircularProgress size={24} />
          </Stack>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Card>
        <Stack spacing={3} sx={{py: 2}}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Workspace Invitation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You have been invited to join a workspace
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Workspace
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {invitation.workspace.name}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Role
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {invitation.role}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Invited by
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {invitation.inviter.email}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Expires
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {formatDateShort(invitation.expiresAt, dateFormat)}
            </Typography>
          </Box>

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={() => {
                void navigate('/workspaces');
              }}
              disabled={accepting}
            >
              Decline
            </Button>
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting ? 'Accepting...' : 'Accept Invitation'}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </PageContainer>
  );
}
