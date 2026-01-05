/**
 * Payees Page
 * Lists all payees (default and user-specific)
 */

import React, {memo} from 'react';
import {Box, List, ListItemButton, ListItemText, Card, Typography, Divider} from '@mui/material';
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
    return <LoadingSpinner useSkeleton skeletonVariant="list" skeletonCount={5} />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Payees"
        message={error.message}
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  if (payees.length === 0) {
    return (
      <Box>
        <Card sx={{p: 4}}>
          <Box sx={{textAlign: 'center', py: 4}}>
            <Typography variant="h6" color="text.secondary" sx={{mb: 1}}>
              No Payees Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Payees help you track who you&apos;re transacting with. Create one to get started.
            </Typography>
          </Box>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Card>
        <List disablePadding>
          {payees.map((payee, index) => (
            <React.Fragment key={payee.id}>
              {index > 0 && <Divider />}
              <ListItemButton
                onClick={(): void => {
                  void navigate(`/payees/${payee.id}`);
                }}
                sx={{
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemText
                  primary={payee.name}
                  primaryTypographyProps={{
                    variant: 'body1',
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>
            </React.Fragment>
          ))}
        </List>
      </Card>
    </Box>
  );
};

PayeesPageComponent.displayName = 'PayeesPage';

export const PayeesPage = memo(PayeesPageComponent);

