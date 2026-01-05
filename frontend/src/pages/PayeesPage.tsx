/**
 * Payees Page
 * Lists all payees (default and user-specific)
 * Follows Material Design 3 patterns
 */

import React, {memo} from 'react';
import {Box, List, ListItemButton, ListItemText, Divider} from '@mui/material';
import {useNavigate} from 'react-router';
import {Person} from '@mui/icons-material';
import {usePayees} from '../hooks/usePayees';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {EmptyState} from '../components/common/EmptyState';
import {Card} from '../components/ui/Card';

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
      <EmptyState
        icon={<Person />}
        title="No Payees Yet"
        description="Payees help you track who you're transacting with. Create one to get started."
      />
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
                  py: 1.5,
                  px: 2,
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

