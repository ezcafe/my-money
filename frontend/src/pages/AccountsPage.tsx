/**
 * Accounts Page
 * Lists all accounts with total amounts
 * Follows Material Design 3 patterns
 */

import React, {memo} from 'react';
import {Box, Typography, List, ListItemButton, ListItemText, Divider} from '@mui/material';
import {useNavigate} from 'react-router';
import {AccountBalance} from '@mui/icons-material';
import {useAccounts} from '../hooks/useAccounts';
import {formatCurrencyPreserveDecimals} from '../utils/formatting';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {EmptyState} from '../components/common/EmptyState';
import {Card} from '../components/ui/Card';

/**
 * Accounts Page Component
 */
const AccountsPageComponent = (): React.JSX.Element => {
  const {accounts, loading, error} = useAccounts();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner useSkeleton skeletonVariant="list" skeletonCount={5} />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Accounts"
        message={error.message}
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<AccountBalance />}
        title="No Accounts Yet"
        description="Get started by creating your first account to track your finances."
      />
    );
  }

  return (
    <Box>
      <Card>
        <List disablePadding>
          {accounts.map((account, index) => (
            <React.Fragment key={account.id}>
              {index > 0 && <Divider />}
              <ListItemButton
                onClick={(): void => {
                  void navigate(`/accounts/${account.id}`);
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
                  primary={account.name}
                  primaryTypographyProps={{
                    variant: 'body1',
                    fontWeight: 500,
                  }}
                />
                <Typography variant="body1" fontWeight={500} color="text.primary">
                  {formatCurrencyPreserveDecimals(account.balance)}
                </Typography>
              </ListItemButton>
            </React.Fragment>
          ))}
        </List>
      </Card>
    </Box>
  );
};

AccountsPageComponent.displayName = 'AccountsPage';

export const AccountsPage = memo(AccountsPageComponent);


