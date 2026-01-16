/**
 * Dialog Wrapper Component
 * Wraps MUI Dialog for abstraction
 */

import React from 'react';
import {
  Dialog as MUIDialog,
  type DialogProps as MUIDialogProps,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

export interface DialogProps extends Omit<MUIDialogProps, 'ref' | 'title'> {
  children: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * Dialog component wrapper
 * Allows easy framework switching in the future
 */
export const Dialog: React.FC<DialogProps> = ({children, title, actions, ...props}) => {
  return (
    <MUIDialog {...props}>
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      <DialogContent>{children}</DialogContent>
      {actions ? <DialogActions>{actions}</DialogActions> : null}
    </MUIDialog>
  );
};

Dialog.displayName = 'Dialog';






















