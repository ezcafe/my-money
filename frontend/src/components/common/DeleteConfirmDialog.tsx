/**
 * Delete Confirm Dialog Component
 * Reusable dialog for confirming deletion of entities
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
} from '@mui/material';

interface DeleteConfirmDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;
  /**
   * Callback when dialog is closed (canceled)
   */
  onClose: () => void;
  /**
   * Callback when deletion is confirmed
   */
  onConfirm: () => void;
  /**
   * Title of the dialog
   */
  title: string;
  /**
   * Message to display in the dialog
   */
  message: string;
  /**
   * Whether the deletion is in progress
   */
  deleting?: boolean;
  /**
   * Label for the confirm button (default: 'Delete')
   */
  confirmLabel?: string;
  /**
   * Label for the cancel button (default: 'Cancel')
   */
  cancelLabel?: string;
}

/**
 * Delete Confirm Dialog Component
 * Provides a consistent UI for confirming deletions across the application
 */
export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  deleting = false,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
}: DeleteConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} color="error" disabled={deleting}>
          {deleting ? 'Deleting...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


