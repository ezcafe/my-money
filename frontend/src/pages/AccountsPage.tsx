/**
 * Accounts Page
 * Lists all accounts with total amounts
 */

import React, {memo} from 'react';
import {Box, Typography, List, ListItemButton, ListItemText} from '@mui/material';
import {Card} from '../components/ui/Card';
import {useNavigate} from 'react-router';
import {useAccounts} from '../hooks/useAccounts';
import {formatCurrencyPreserveDecimals} from '../utils/formatting';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';

/**
 * Accounts Page Component
 */
const AccountsPageComponent = (): React.JSX.Element => {
  const {accounts, loading, error} = useAccounts();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner message="Loading accounts..." />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Accounts"
        message={error.message}
      />
    );
  }

  return (
    <Box sx={{p: 2, width: '100%'}}>
      <Card>
        <List>
          {accounts.map((account) => (
            <ListItemButton
              key={account.id}
              onClick={(): void => {
                void navigate(`/accounts/${account.id}`);
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
                primary={account.name}
                sx={{flex: '0 1 auto'}}
              />
              <Typography
                variant="body1"
                sx={{
                  flexShrink: 0,
                  ml: 2,
                  textAlign: 'right',
                }}
              >
                {formatCurrencyPreserveDecimals(account.balance)}
              </Typography>
            </ListItemButton>
          ))}
        </List>
      </Card>
    </Box>
  );
};

AccountsPageComponent.displayName = 'AccountsPage';

export const AccountsPage = memo(AccountsPageComponent);


