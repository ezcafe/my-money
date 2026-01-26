/**
 * Payees Page
 * Lists all payees (default and user-specific)
 * Follows Material Design 3 patterns
 */

import React, { memo } from 'react';
import { List, ListItemButton, ListItemText, Divider, Chip, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { Person, Star } from '@mui/icons-material';
import { usePayees } from '../hooks/usePayees';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
import { PageContainer } from '../components/common/PageContainer';
import { useLocationRefetch, useSearchFilter } from '../hooks';

/**
 * Payees Page Component
 */
const PayeesPageComponent = (): React.JSX.Element => {
  const { payees, loading, error, refetch } = usePayees();
  const navigate = useNavigate();

  // Refetch when returning from create page
  useLocationRefetch({
    refetchFunctions: [refetch],
    watchPathname: '/payees',
  });

  /**
   * Filter payees based on search query
   */
  const { filteredItems: filteredPayees, hasNoSearchResults } = useSearchFilter({
    items: payees,
    getSearchableText: (payee) => payee.name,
  });

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
    <PageContainer>
      {hasNoSearchResults ? (
        <EmptyState title="No payees found" description="Try adjusting your search query" />
      ) : null}
      {filteredPayees.length > 0 ? (
        <Card>
          <List disablePadding>
            {filteredPayees.map((payee, index) => (
              <React.Fragment key={payee.id}>
                {index > 0 && <Divider />}
                <ListItemButton
                  onClick={(): void => {
                    void navigate(`/payees/${payee.id}`);
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
                          {payee.name}
                        </Typography>
                        {payee.isDefault ? (
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
                  />
                </ListItemButton>
              </React.Fragment>
            ))}
          </List>
        </Card>
      ) : null}
    </PageContainer>
  );
};

PayeesPageComponent.displayName = 'PayeesPage';

export const PayeesPage = memo(PayeesPageComponent);
