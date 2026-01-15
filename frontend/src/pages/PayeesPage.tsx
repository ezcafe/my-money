/**
 * Payees Page
 * Lists all payees (default and user-specific)
 * Follows Material Design 3 patterns
 */

import React, {memo, useEffect, useMemo} from 'react';
import {Box, List, ListItemButton, ListItemText, Divider} from '@mui/material';
import {useNavigate, useLocation} from 'react-router';
import {Person} from '@mui/icons-material';
import {usePayees} from '../hooks/usePayees';
import {useSearch} from '../contexts/SearchContext';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {EmptyState} from '../components/common/EmptyState';
import {Card} from '../components/ui/Card';
import {pageContainerStyle} from '../constants/ui';

/**
 * Payees Page Component
 */
const PayeesPageComponent = (): React.JSX.Element => {
  const location = useLocation();
  const {payees, loading, error, refetch} = usePayees();
  const {searchQuery} = useSearch();
  const navigate = useNavigate();

  // Refetch when returning from create page
  useEffect(() => {
    if (location.pathname === '/payees') {
      void refetch();
    }
  }, [location.pathname, refetch]);

  /**
   * Filter payees based on search query
   */
  const filteredPayees = useMemo(() => {
    if (!searchQuery.trim()) {
      return payees;
    }
    const query = searchQuery.toLowerCase().trim();
    return payees.filter((payee) => payee.name.toLowerCase().includes(query));
  }, [payees, searchQuery]);

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

  const hasSearchResults = filteredPayees.length > 0;
  const hasNoSearchResults = searchQuery.trim() && !hasSearchResults;

  return (
    <Box sx={pageContainerStyle}>
      {hasNoSearchResults && (
        <EmptyState
          title="No payees found"
          description="Try adjusting your search query"
        />
      )}
      {hasSearchResults && (
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
      )}
    </Box>
  );
};

PayeesPageComponent.displayName = 'PayeesPage';

export const PayeesPage = memo(PayeesPageComponent);

