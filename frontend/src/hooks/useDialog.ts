/**
 * Dialog Hook
 * Manages dialog open/close state with optional reset callback
 * Reduces boilerplate for dialog state management
 */

import { useState, useCallback } from 'react';

/**
 * Options for useDialog hook
 */
interface UseDialogOptions {
  /** Initial open state */
  initialOpen?: boolean;
  /** Callback to reset form/dialog state when closing */
  onClose?: () => void;
}

/**
 * Return type for useDialog hook
 */
interface UseDialogReturn {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Open the dialog */
  openDialog: () => void;
  /** Close the dialog */
  closeDialog: () => void;
  /** Toggle dialog state */
  toggleDialog: () => void;
}

/**
 * Hook to manage dialog open/close state
 * Provides consistent dialog state management across components
 *
 * @param options - Dialog options
 * @returns Dialog state and control functions
 * @example
 * ```tsx
 * const { isOpen, openDialog, closeDialog } = useDialog({
 *   onClose: () => {
 *     setFormData(initialFormData);
 *   }
 * });
 * ```
 */
export function useDialog(options: UseDialogOptions = {}): UseDialogReturn {
  const { initialOpen = false, onClose } = options;
  const [isOpen, setIsOpen] = useState(initialOpen);

  const openDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const toggleDialog = useCallback(() => {
    setIsOpen((prev) => {
      const newValue = !prev;
      if (!newValue && onClose) {
        onClose();
      }
      return newValue;
    });
  }, [onClose]);

  return {
    isOpen,
    openDialog,
    closeDialog,
    toggleDialog,
  };
}
