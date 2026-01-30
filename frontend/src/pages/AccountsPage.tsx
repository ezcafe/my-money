/**
 * Accounts Page
 * Lists all accounts with total amounts
 * Follows Material Design 3 patterns
 */

import React, { memo, useTransition } from 'react';
import { Typography, List, ListItemButton, ListItemText, ListItemIcon, Divider, Chip, Stack } from '@mui/material';
import { useNavigate } from 'react-router';
import { AccountBalance, Star, ChevronRight } from '@mui/icons-material';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrencyPreserveDecimals } from '../utils/formatting';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
import { PageContainer } from '../components/common/PageContainer';
import { useSearchFilter } from '../hooks';

/**
 * Accounts Page Component
 */
const AccountsPageComponent = (): React.JSX.Element => {
  const { accounts, loading, error } = useAccounts();
  const navigate = useNavigate();
  const [_isPending, _startTransition] = useTransition();

  /**
   * Filter accounts based on search query (non-urgent update)
   */
  const { filteredItems: filteredAccounts, hasNoSearchResults } = useSearchFilter({
    items: accounts,
    getSearchableText: (account) => account.name,
  });

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
    <PageContainer>
      {hasNoSearchResults ? (
        <EmptyState title="No accounts found" description="Try adjusting your search query" />
      ) : null}
      {filteredAccounts.length > 0 ? (
        <Card>
          <List disablePadding>
            {filteredAccounts.map((account, index) => (
              <React.Fragment key={account.id}>
                {index > 0 && <Divider />}
                <ListItemButton
                  onClick={(): void => {
                    void navigate(`/accounts/${account.id}`);
                  }}
                  sx={{
                    py: 1.5,
                    px: 3,
                    transition: 'background-color 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1" fontWeight={500}>
                          {account.name}
                        </Typography>
                        {account.isDefault ? (
                          <Chip
                            icon={<Star fontSize="inherit" />}
                            label="Default"
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              '& .MuiChip-icon': {
                                fontSize: '0.75rem',
                              },
                            }}
                          />
                        ) : null}
                      </Stack>
                    }
                    primaryTypographyProps={{ component: 'div' }}
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1" fontWeight={500} color="text.primary">
                      {formatCurrencyPreserveDecimals(account.balance)}
                    </Typography>
                    <ListItemIcon sx={{ minWidth: 'auto' }}>
                      <ChevronRight color="action" />
                    </ListItemIcon>
                  </Stack>
                </ListItemButton>
              </React.Fragment>
            ))}
          </List>
        </Card>
      ) : null}
    </PageContainer>
  );
};

AccountsPageComponent.displayName = 'AccountsPage';

export const AccountsPage = memo(AccountsPageComponent);
