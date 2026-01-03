/**
 * Accounts Page
 * Lists all accounts with total amounts
 */

import React, {memo} from 'react';
import {Box, Typography, List, ListItemButton, ListItemText, Divider, Card} from '@mui/material';
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
              >
                <ListItemText
                  primary={account.name}
                  primaryTypographyProps={{
                    variant: 'body1',
                    fontWeight: 500,
                  }}
                />
                <Typography variant="body1" fontWeight={500}>
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


