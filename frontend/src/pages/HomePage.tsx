/**
 * Home Page
 * Main page that displays the calculator and transaction history
 * Follows Material Design 3 nested container pattern
 */

import React, { memo } from 'react';
import { Box, Alert } from '@mui/material';
import { Calculator } from '../components/Calculator';
import { PageContainer } from '../components/common/PageContainer';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { AccountBalance } from '@mui/icons-material';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { useNotifications } from '../contexts/NotificationContext';
import { WorkspaceSwitchButton } from '../components/WorkspaceSwitchButton';

/**
 * Home Page Component
 */
const HomePageComponent = (): React.JSX.Element => {
  // Data fetching hooks
  const { accounts, loading: accountsLoading, error: accountsError } = useAccounts();
  const {
    categories: _categories,
    loading: categoriesLoading,
    error: categoriesError,
  } = useCategories();
  const { errorMessage, errorOpen, handleErrorClose } = useNotifications();

  // Loading state
  if (accountsLoading || categoriesLoading) {
    return <LoadingSpinner message="Loading calculator..." />;
  }

  // Error state
  if (accountsError || categoriesError) {
    return (
      <ErrorAlert
        title="Error Loading Data"
        message={
          accountsError?.message ?? categoriesError?.message ?? 'Error loading calculator data'
        }
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  // Empty state - need at least one account to use calculator
  if (accounts.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          icon={<AccountBalance />}
          title="No Accounts Yet"
          description="Get started by creating your first account to track your finances."
        />
      </PageContainer>
    );
  }

  // Main content
  return (
    <PageContainer>
      {/* Error notification positioned above workspace switcher button */}
      {errorOpen && errorMessage ? (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: (theme) => theme.zIndex.appBar + 2,
            maxWidth: { xs: 'calc(100vw - 32px)', sm: '400px' },
            // Position above workspace switcher (button is 56px + 16px top = 72px from top)
            // Add some spacing, so error appears clearly above
            mb: 2,
          }}
        >
          <Alert
            severity="error"
            onClose={handleErrorClose}
            sx={{
              boxShadow: 3,
            }}
          >
            {errorMessage}
          </Alert>
        </Box>
      ) : null}
      <WorkspaceSwitchButton />
      <Calculator />
    </PageContainer>
  );
};

HomePageComponent.displayName = 'HomePage';

export const HomePage = memo(HomePageComponent);
