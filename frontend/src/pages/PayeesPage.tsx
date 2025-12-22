/**
 * Payees Page
 * Lists all payees (default and user-specific)
 */

import React, {memo} from 'react';
import {Box, List, ListItemButton, ListItemText} from '@mui/material';
import {Card} from '../components/ui/Card';
import {useNavigate} from 'react-router';
import {usePayees} from '../hooks/usePayees';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';

/**
 * Payees Page Component
 */
const PayeesPageComponent = (): React.JSX.Element => {
  const {payees, loading, error} = usePayees();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner message="Loading payees..." />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Payees"
        message={error.message}
      />
    );
  }

  return (
    <Box sx={{p: 2, width: '100%'}}>
      <Card>
        <List>
          {payees.map((payee) => (
            <ListItemButton
              key={payee.id}
              onClick={(): void => {
                void navigate(`/payees/${payee.id}`);
              }}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemText
                primary={payee.name}
                sx={{flex: '0 1 auto'}}
              />
            </ListItemButton>
          ))}
        </List>
      </Card>
    </Box>
  );
};

PayeesPageComponent.displayName = 'PayeesPage';

export const PayeesPage = memo(PayeesPageComponent);

