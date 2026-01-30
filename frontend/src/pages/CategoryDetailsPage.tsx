/**
 * Category Details Page
 * Shows category details with paginated transactions
 */

import React, { useState, memo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { Box } from '@mui/material';
import { useMutation, useQuery } from '@apollo/client/react';
import { useCategory } from '../hooks/useCategory';
import {
  useTransactions,
  type TransactionOrderInput,
  type TransactionOrderByField,
} from '../hooks/useTransactions';
import { ITEMS_PER_PAGE } from '../constants';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { DELETE_TRANSACTION } from '../graphql/mutations';
import {
  GET_SETTINGS,
  GET_TRANSACTIONS,
  GET_RECENT_TRANSACTIONS,
  GET_CATEGORY,
} from '../graphql/queries';
import { useSearch } from '../contexts/SearchContext';
import { useHeader } from '../contexts/HeaderContext';
import { TransactionList } from '../components/TransactionList';
import { PageContainer } from '../components/common/PageContainer';
import { VersionHistoryPanel } from '../components/VersionHistoryPanel';

/**
 * Category Details Page Component
 */
const CategoryDetailsPageComponent = (): React.JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef<string>(location.pathname);
  const [page, setPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]);

  // Sorting state
  const [sortField, setSortField] = useState<TransactionOrderByField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Search state
  const { searchQuery, clearSearch } = useSearch();
  const isSearchMode = Boolean(searchQuery);

  // Title state
  const { setTitle } = useHeader();

  // Get currency setting
  const { data: settingsData } = useQuery<{ settings?: { currency: string } }>(
    GET_SETTINGS
  );
  const currency = settingsData?.settings?.currency ?? 'USD';

  // Build orderBy object
  const orderBy: TransactionOrderInput | undefined =
    sortField && sortDirection ? { field: sortField, direction: sortDirection } : undefined;

  const currentCursor = page > 1 ? cursorHistory[page - 1] : undefined;

  const {
    category,
    loading: categoryLoading,
    error: categoryError,
    refetch: refetchCategory,
  } = useCategory(id);
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions(
    undefined,
    id,
    undefined,
    ITEMS_PER_PAGE,
    currentCursor,
    orderBy,
    searchQuery || undefined,
    !id
  );

  useEffect(() => {
    if (transactions.nextCursor && page === cursorHistory.length) {
      setCursorHistory((prev) => [...prev, transactions.nextCursor]);
    }
  }, [transactions.nextCursor, page, cursorHistory.length]);

  useEffect(() => {
    setPage(1);
    setCursorHistory([undefined]);
  }, [searchQuery, sortField, sortDirection]);

  // Set appbar title when category is loaded
  useEffect(() => {
    if (category) {
      setTitle(category.name);
    }
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [category, setTitle]);

  const [deleteTransaction] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: [
      { query: GET_TRANSACTIONS },
      { query: GET_RECENT_TRANSACTIONS },
      { query: GET_CATEGORY },
    ],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void refetchTransactions();
      void refetchCategory();
    },
  });

  /**
   * Handle sort change
   */
  const handleSortChange = useCallback(
    (field: TransactionOrderByField, direction: 'asc' | 'desc') => {
      setSortField(field);
      setSortDirection(direction);
      setPage(1);
      setCursorHistory([undefined]);
    },
    []
  );

  /**
   * Handle row click - navigate to transaction edit page
   */
  const handleRowClick = useCallback(
    (transactionId: string) => {
      if (id) {
        const returnTo = `/categories/${id}`;
        void navigate(
          `/transactions/${transactionId}/edit?returnTo=${encodeURIComponent(returnTo)}`
        );
      }
    },
    [id, navigate]
  );

  /**
   * Handle edit click - navigate to edit page
   */
  const handleEdit = useCallback(
    (transactionId: string) => {
      if (id) {
        const returnTo = `/categories/${id}`;
        void navigate(
          `/transactions/${transactionId}/edit?returnTo=${encodeURIComponent(returnTo)}`
        );
      }
    },
    [id, navigate]
  );

  /**
   * Handle delete click
   */
  const handleDelete = useCallback(
    (transactionId: string) => {
      void deleteTransaction({
        variables: { id: transactionId },
      });
    },
    [deleteTransaction]
  );

  // Refetch data when returning from edit page
  useEffect(() => {
    // If we navigated back from a different path (e.g., from edit page), refetch data
    if (
      prevLocationRef.current !== location.pathname &&
      prevLocationRef.current.includes('/transactions/')
    ) {
      void refetchTransactions();
      void refetchCategory();
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, refetchTransactions, refetchCategory]);

  // Show full-page loading only when category is loading (initial load)
  if (categoryLoading) {
    return <LoadingSpinner message="Loading category details..." />;
  }

  if (categoryError) {
    return (
      <ErrorAlert
        title="Error Loading Category"
        message={categoryError?.message ?? 'Error loading category details'}
      />
    );
  }

  if (!category) {
    return (
      <ErrorAlert
        title="Category Not Found"
        message="The requested category could not be found."
        severity="warning"
      />
    );
  }

  return (
    <PageContainer>
      <Box sx={id ? { mb: 3 } : undefined}>
        <TransactionList
          transactions={transactions}
          loading={transactionsLoading}
          error={transactionsError}
          currency={currency}
          page={page}
          onPageChange={setPage}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onRowClick={handleRowClick}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isSearchMode={isSearchMode}
          onClearSearch={clearSearch}
          showAccountColumn={true}
          showCategoryColumn={false}
          showPayeeColumn={true}
          sortableFields={['date', 'value', 'payee']}
        />
      </Box>

      {/* Version History Section - pass current category so only changed fields are shown */}
      {id ? (
        <VersionHistoryPanel
          entityType="Category"
          entityId={id}
          currentData={category ? (category as unknown as Record<string, unknown>) : undefined}
        />
      ) : null}
    </PageContainer>
  );
};

CategoryDetailsPageComponent.displayName = 'CategoryDetailsPage';

export const CategoryDetailsPage = memo(CategoryDetailsPageComponent);
