/**
 * Account Details Page
 * Shows account details with paginated transactions and charts
 */

import React, {useState, memo, useCallback, useEffect, useRef} from 'react';
import {useParams, useNavigate, useLocation} from 'react-router';
import {Typography} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {useAccount} from '../hooks/useAccount';
import {useTransactions, type TransactionOrderInput, type TransactionOrderByField} from '../hooks/useTransactions';
import {formatCurrencyPreserveDecimals} from '../utils/formatting';
import {ITEMS_PER_PAGE} from '../constants';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {GET_PREFERENCES, GET_TRANSACTIONS, GET_RECENT_TRANSACTIONS, GET_ACCOUNT} from '../graphql/queries';
import {useSearch} from '../contexts/SearchContext';
import {useTitle} from '../contexts/TitleContext';
import {TransactionList} from '../components/TransactionList';
import {Card} from '../components/ui/Card';
import {PageContainer} from '../components/common/PageContainer';

/**
 * Account Details Page Component
 */
const AccountDetailsPageComponent = (): React.JSX.Element => {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef<string>(location.pathname);
  const [page, setPage] = useState(1);
  // Cursor history: index 0 = first page (no cursor), index 1 = cursor for page 2, etc.
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]);

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

  // Get cursor for current page (page 1 = undefined, page 2 = cursorHistory[1], etc.)
  const currentCursor = page > 1 ? cursorHistory[page - 1] : undefined;

  const {account, loading: accountLoading, error: accountError, refetch: refetchAccount} =
    useAccount(id);
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions(id, undefined, undefined, ITEMS_PER_PAGE, currentCursor, orderBy, searchQuery || undefined);

  // Update cursor history when we get a new nextCursor
  useEffect(() => {
    if (transactions.nextCursor && page === cursorHistory.length) {
      // We're on the last page we've visited, add the next cursor
      setCursorHistory((prev) => [...prev, transactions.nextCursor]);
    }
  }, [transactions.nextCursor, page, cursorHistory.length]);

  // Reset page and cursor history when search or sort changes
  useEffect(() => {
    setPage(1);
    setCursorHistory([undefined]);
  }, [searchQuery, sortField, sortDirection]);

  // Set appbar title when account is loaded
  useEffect(() => {
    if (account) {
      setTitle(account.name);
    }
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [account, setTitle]);

  const [deleteTransaction] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: id ? [{query: GET_TRANSACTIONS}, {query: GET_RECENT_TRANSACTIONS}, {query: GET_ACCOUNT, variables: {id}}] : [{query: GET_TRANSACTIONS}, {query: GET_RECENT_TRANSACTIONS}],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void refetchTransactions();
      void refetchAccount();
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
    [],
  );

  /**
   * Handle row click - navigate to transaction edit page
   */
  const handleRowClick = useCallback(
    (transactionId: string) => {
      if (id) {
        const returnTo = `/accounts/${id}`;
        void navigate(`/transactions/${transactionId}/edit?returnTo=${encodeURIComponent(returnTo)}`);
      }
    },
    [id, navigate],
  );

  /**
   * Handle edit click - navigate to edit page
   */
  const handleEdit = useCallback(
    (transactionId: string) => {
      if (id) {
        const returnTo = `/accounts/${id}`;
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
      void refetchAccount();
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, refetchTransactions, refetchAccount]);

  // Show full-page loading only when account is loading (initial load)
  if (accountLoading) {
    return <LoadingSpinner message="Loading account details..." />;
  }

  if (accountError) {
    return (
      <ErrorAlert
        title="Error Loading Account"
        message={accountError?.message ?? 'Error loading account details'}
      />
    );
  }

  if (!account) {
    return (
      <ErrorAlert
        title="Account Not Found"
        message="The requested account could not be found."
        severity="warning"
      />
    );
  }

  return (
    <PageContainer>
      <Card sx={{mb: 3, p: 3}}>
        <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
          Balance
        </Typography>
        <Typography variant="h3" component="div" color="primary.main" fontWeight={600}>
          {formatCurrencyPreserveDecimals(account.balance, currency)}
        </Typography>
      </Card>

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
        showAccountColumn={false}
        showCategoryColumn={true}
        showPayeeColumn={true}
        sortableFields={['date', 'value', 'category', 'payee']}
      />
    </PageContainer>
  );
};

AccountDetailsPageComponent.displayName = 'AccountDetailsPage';

export const AccountDetailsPage = memo(AccountDetailsPageComponent);
