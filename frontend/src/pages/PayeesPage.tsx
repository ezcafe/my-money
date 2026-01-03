/**
 * Payees Page
 * Lists all payees (default and user-specific)
 */

import React, {memo} from 'react';
import {Box, List, ListItemButton, ListItemText, Card} from '@mui/material';
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
    <Box>
      <Card>
        <List>
          {payees.map((payee) => (
            <ListItemButton
              key={payee.id}
              onClick={(): void => {
                void navigate(`/payees/${payee.id}`);
              }}
            >
              <ListItemText primary={payee.name} />
            </ListItemButton>
          ))}
        </List>
      </Card>
    </Box>
  );
};

PayeesPageComponent.displayName = 'PayeesPage';

export const PayeesPage = memo(PayeesPageComponent);

