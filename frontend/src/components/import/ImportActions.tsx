/**
 * Import Actions Component
 * Handles Save and Ignore actions for imported transactions
 */

import React, {memo} from 'react';
import {Box, LinearProgress, useMediaQuery, useTheme} from '@mui/material';
import {Button} from '../ui/Button';

/**
 * ImportActions component props
 */
interface ImportActionsProps {
  saving: boolean;
  deleting: boolean;
  onSave: () => Promise<void>;
  onIgnore: () => Promise<void>;
}

/**
 * Import Actions Component
 */
const ImportActionsComponent = ({saving, deleting, onSave, onIgnore}: ImportActionsProps): React.JSX.Element => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <>
      <Box sx={{display: 'flex', flexDirection: {xs: 'column', sm: 'row'}, gap: 2, justifyContent: 'flex-end'}}>
        <Button
          variant="outlined"
          onClick={(): void => void onIgnore()}
          disabled={deleting || saving}
          fullWidth={isMobile}
        >
          {deleting ? 'Ignoring...' : 'Ignore All'}
        </Button>
        <Button
          variant="contained"
          onClick={(): void => void onSave()}
          disabled={saving || deleting}
          fullWidth={isMobile}
          size="large"
        >
          {saving ? 'Saving Transactions...' : 'Save All Transactions'}
        </Button>
      </Box>
      {saving ? <LinearProgress sx={{mt: 2}} /> : null}
    </>
  );
};

ImportActionsComponent.displayName = 'ImportActions';

export const ImportActions = memo(ImportActionsComponent);
