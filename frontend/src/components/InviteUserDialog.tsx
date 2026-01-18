/**
 * Invite User Dialog Component
 * Dialog for inviting users to a workspace
 */

import React, {useState} from 'react';
import {Box, FormControl, InputLabel, Select, MenuItem} from '@mui/material';
import {useMutation} from '@apollo/client/react';
import {Dialog} from './ui/Dialog';
import {Button} from './ui/Button';
import {TextField} from './ui/TextField';
import {INVITE_USER_TO_WORKSPACE} from '../graphql/workspaceOperations';

type WorkspaceRole = 'Owner' | 'Admin' | 'Member';

export interface InviteUserDialogProps {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Invite User Dialog Component
 */
export function InviteUserDialog({
  open,
  workspaceId,
  onClose,
  onSuccess,
}: InviteUserDialogProps): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('Member');

  const [inviteUser, {loading, error}] = useMutation(INVITE_USER_TO_WORKSPACE, {
    onCompleted: () => {
      setEmail('');
      setRole('Member');
      onSuccess?.();
      onClose();
    },
  });

  const handleInvite = async (): Promise<void> => {
    if (!email.trim() || !workspaceId) {
      return;
    }

    try {
      await inviteUser({
        variables: {
          workspaceId,
          email: email.trim(),
          role,
        },
      });
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite User to Workspace"
      actions={
        <Box sx={{display: 'flex', gap: 1}}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading || !email.trim()}>
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </Box>
      }
    >
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
        {error ? (
          <Box sx={{color: 'error.main', typography: 'body2'}}>{error.message}</Box>
        ) : null}

        <TextField
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          fullWidth
          required
          autoFocus
          placeholder="user@example.com"
        />

        <FormControl fullWidth>
          <InputLabel>Role</InputLabel>
          <Select value={role} label="Role" onChange={(e) => {
            setRole(e.target.value as WorkspaceRole);
          }}>
            <MenuItem value="Member">Member</MenuItem>
            <MenuItem value="Admin">Admin</MenuItem>
            <MenuItem value="Owner">Owner</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Dialog>
  );
}
