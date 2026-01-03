/**
 * Payee Details Page
 * Shows payee details with paginated transactions
 */

import React, {useState, memo, useCallback, useEffect, useRef} from 'react';
import {useParams, useNavigate, useLocation} from 'react-router';
import {Box} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {usePayee} from '../hooks/usePayee';
import {useTransactions, type TransactionOrderInput, type TransactionOrderByField} from '../hooks/useTransactions';
import {ITEMS_PER_PAGE} from '../utils/constants';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {GET_PREFERENCES} from '../graphql/queries';
import {useSearch} from '../contexts/SearchContext';
import {useTitle} from '../contexts/TitleContext';
import {TransactionList} from '../components/TransactionList';

/**
 * Payee Details Page Component
 */
const PayeeDetailsPageComponent = (): React.JSX.Element => {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef<string>(location.pathname);
  const [page, setPage] = useState(1);
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // Sorting state
  const [sortField, setSortField] = useState<TransactionOrderByField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Search state
  const {searchQuery, clearSearch} = useSearch();
  const isSearchMode = Boolean(searchQuery);

  // Title state
  const {setTitle} = useTitle();

  // Get currency preference
  const {data: preferencesData} = useQuery<{preferences?: {currency: string}}>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';

  // Build orderBy object
  const orderBy: TransactionOrderInput | undefined =
    sortField && sortDirection
      ? {field: sortField, direction: sortDirection}
      : undefined;

  const {payee, loading: payeeLoading, error: payeeError, refetch: refetchPayee} =
    usePayee(id);
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions(undefined, undefined, id, skip, ITEMS_PER_PAGE, orderBy, searchQuery || undefined);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

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
    refetchQueries: ['GetTransactions', 'GetRecentTransactions', 'GetPayee'],
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
      setPage(1); // Reset to first page when sorting changes
    },
    [],
  );

  /**
   * Handle edit click - navigate to edit page
   */
  const handleEdit = useCallback(
    (transactionId: string) => {
      if (id) {
        const returnTo = `/payees/${id}`;
        void navigate(`/transactions/${transactionId}/edit?returnTo=${encodeURIComponent(returnTo)}`);
      }
    },
    [id, navigate],
  );

  /**
   * Handle delete click
   */
  const handleDelete = useCallback(
    (transactionId: string) => {
      void deleteTransaction({
        variables: {id: transactionId},
      });
    },
    [deleteTransaction],
  );

  // Refetch data when returning from edit page
  useEffect(() => {
    // If we navigated back from a different path (e.g., from edit page), refetch data
    if (prevLocationRef.current !== location.pathname && prevLocationRef.current.includes('/transactions/')) {
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
    <Box>
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
  );
};

PayeeDetailsPageComponent.displayName = 'PayeeDetailsPage';

export const PayeeDetailsPage = memo(PayeeDetailsPageComponent);

