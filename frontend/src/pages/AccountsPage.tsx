/**
 * Accounts Page
 * Lists all accounts with total amounts and Report button
 */

import React, {memo} from 'react';
import {Box, Typography, List, ListItemButton, ListItemText} from '@mui/material';
import {Button} from '../components/ui/Button';
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
      <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: 2}}>
        <Button
          variant="contained"
          onClick={(): void => {
            void navigate('/report');
          }}
        >
          Report
        </Button>
      </Box>

      <Card sx={{p: 0}}>
        <List sx={{backgroundColor: 'transparent', padding: 0}}>
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


