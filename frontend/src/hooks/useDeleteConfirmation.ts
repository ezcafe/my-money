/**
 * Delete Confirmation Hook
 * Provides reusable delete confirmation dialog logic
 */

import React, {useState, useCallback} from 'react';
import {DeleteConfirmDialog} from '../components/common/DeleteConfirmDialog';

/**
 * Options for delete confirmation
 */
interface UseDeleteConfirmationOptions {
  /** Title for the delete dialog */
  title: string;
  /** Message for the delete dialog */
  message: string;
  /** Whether deletion is in progress */
  deleting?: boolean;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
  /** Optional custom confirm label */
  confirmLabel?: string;
  /** Optional custom cancel label */
  cancelLabel?: string;
}

/**
 * Return type for useDeleteConfirmation hook
 */
interface UseDeleteConfirmationReturn {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Function to open the delete dialog */
  openDialog: () => void;
  /** Function to close the delete dialog */
  closeDialog: () => void;
  /** Delete confirmation dialog component */
  DeleteDialog: React.ReactElement;
}

/**
 * Hook for managing delete confirmation dialogs
 * @param options - Delete confirmation options
 * @returns Delete confirmation state and dialog component
 */
export function useDeleteConfirmation(options: UseDeleteConfirmationOptions): UseDeleteConfirmationReturn {
  const {title, message, deleting = false, onConfirm, confirmLabel, cancelLabel} = options;
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm();
    // Don't close dialog here - let the component handle it after deletion completes
  }, [onConfirm]);

  const DeleteDialog: React.ReactElement = React.createElement(DeleteConfirmDialog, {
    open: isOpen,
    onClose: closeDialog,
    onConfirm: handleConfirm,
    title,
    message,
    deleting,
    confirmLabel,
    cancelLabel,
  });

  return {
    isOpen,
    openDialog,
    closeDialog,
    DeleteDialog,
  };
}

