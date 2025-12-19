/**
 * Accounts Page
 * Lists all accounts with total amounts and Report button
 */

import React, {memo} from 'react';
import {Box, Typography, Grid} from '@mui/material';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {useNavigate} from 'react-router';
import {useAccounts} from '../hooks/useAccounts';
import {formatCurrency} from '../utils/formatting';
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
    <Box sx={{p: 2, maxWidth: 1200, mx: 'auto'}}>
      <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 3}}>
        <Typography variant="h4">Accounts</Typography>
        <Button
          variant="contained"
          onClick={(): void => {
            void navigate('/report');
          }}
        >
          Report
        </Button>
      </Box>

      <Grid container spacing={2}>
        {accounts.map((account) => (
          <Grid item xs={12} sm={6} md={4} key={account.id}>
            <Card
              sx={{p: 2, cursor: 'pointer'}}
              onClick={(): void => {
                void navigate(`/accounts/${account.id}`);
              }}
            >
              <Typography variant="h6">{account.name}</Typography>
              <Typography variant="h5" color="primary">
                {formatCurrency(account.balance)}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

AccountsPageComponent.displayName = 'AccountsPage';

export const AccountsPage = memo(AccountsPageComponent);


