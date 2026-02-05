/**
 * Payee Details Page
 * Shows payee details with paginated transactions
 */

import React, { useState, memo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { Box } from '@mui/material';
import { useMutation, useQuery } from '@apollo/client/react';
import { usePayee } from '../hooks/usePayee';
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
  GET_PAYEE,
} from '../graphql/queries';
import { useSearch } from '../contexts/SearchContext';
import { useHeader } from '../contexts/HeaderContext';
import { TransactionList } from '../components/TransactionList';
import { PageContainer } from '../components/common/PageContainer';
import { VersionHistoryPanel } from '../components/VersionHistoryPanel';

/**
 * Payee Details Page Component
 */
const PayeeDetailsPageComponent = (): React.JSX.Element => {
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
  const { data: settingsData } = useQuery<{ settings?: { currency: string } }>(GET_SETTINGS);
  const currency = settingsData?.settings?.currency ?? 'USD';

  // Build orderBy object
  const orderBy: TransactionOrderInput | undefined =
    sortField && sortDirection ? { field: sortField, direction: sortDirection } : undefined;

  const currentCursor = page > 1 ? cursorHistory[page - 1] : undefined;

  const { payee, loading: payeeLoading, error: payeeError, refetch: refetchPayee } = usePayee(id);
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions(
    undefined,
    undefined,
    id,
    ITEMS_PER_PAGE,
    currentCursor,
    orderBy,
    searchQuery || undefined
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

  // Set appbar title when payee is loaded
  useEffect(() => {
    if (payee) {
      setTitle(payee.name);
    }
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [payee, setTitle]);

  const [deleteTransaction] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: [
      { query: GET_TRANSACTIONS },
      { query: GET_RECENT_TRANSACTIONS },
      { query: GET_PAYEE },
    ],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void refetchTransactions();
      void refetchPayee();
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
        const returnTo = `/payees/${id}`;
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
        const returnTo = `/payees/${id}`;
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
      void refetchPayee();
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, refetchTransactions, refetchPayee]);

  // Show full-page loading only when payee is loading (initial load)
  if (payeeLoading) {
    return <LoadingSpinner message="Loading payee details..." />;
  }

  if (payeeError) {
    return (
      <ErrorAlert
        title="Error Loading Payee"
        message={payeeError?.message ?? 'Error loading payee details'}
      />
    );
  }

  if (!payee) {
    return (
      <ErrorAlert
        title="Payee Not Found"
        message="The requested payee could not be found."
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
          showCategoryColumn={true}
          showPayeeColumn={false}
          sortableFields={['date', 'value', 'category']}
        />
      </Box>

      {/* Version History Section - pass current payee so only changed fields are shown */}
      {id ? (
        <VersionHistoryPanel
          entityType="Payee"
          entityId={id}
          currentData={payee ? (payee as unknown as Record<string, unknown>) : undefined}
        />
      ) : null}
    </PageContainer>
  );
};

PayeeDetailsPageComponent.displayName = 'PayeeDetailsPage';

export const PayeeDetailsPage = memo(PayeeDetailsPageComponent);
