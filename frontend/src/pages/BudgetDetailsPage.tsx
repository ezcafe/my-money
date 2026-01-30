/**
 * Budget Details Page
 * Shows budget details with paginated transactions
 */

import React, { useState, memo, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { Box } from '@mui/material';
import { useMutation, useQuery } from '@apollo/client/react';
import { useBudget } from '../hooks/useBudget';
import type { TransactionOrderInput, TransactionOrderByField } from '../hooks/useTransactions';
import { ITEMS_PER_PAGE } from '../constants';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { DELETE_TRANSACTION } from '../graphql/mutations';
import {
  GET_SETTINGS,
  GET_REPORT_TRANSACTIONS,
  GET_TRANSACTIONS,
  GET_RECENT_TRANSACTIONS,
  GET_BUDGET,
} from '../graphql/queries';
import { useSearch } from '../contexts/SearchContext';
import { useHeader } from '../contexts/HeaderContext';
import { TransactionList } from '../components/TransactionList';
import { PageContainer } from '../components/common/PageContainer';
import { VersionHistoryPanel } from '../components/VersionHistoryPanel';
import { BudgetSummary } from '../components/budget/BudgetSummary';

/**
 * Budget Details Page Component
 */
const BudgetDetailsPageComponent = (): React.JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef<string>(location.pathname);
  const [page, setPage] = useState(1);
  const skip = (page - 1) * ITEMS_PER_PAGE;

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

  const {
    budget,
    loading: budgetLoading,
    error: budgetError,
    refetch: refetchBudget,
  } = useBudget(id);

  // Calculate current month start and end dates
  const currentMonthDates = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      startDate: monthStart.toISOString(),
      endDate: monthEnd.toISOString(),
    };
  }, []);

  // Build query variables for reportTransactions
  const queryVariables = useMemo(() => {
    // Build orderBy object inside useMemo
    const orderBy: TransactionOrderInput =
      sortField && sortDirection
        ? { field: sortField, direction: sortDirection }
        : { field: 'date', direction: 'desc' };

    const vars: {
      accountIds?: string[];
      categoryIds?: string[];
      payeeIds?: string[];
      startDate?: string;
      endDate?: string;
      note?: string;
      orderBy: TransactionOrderInput;
      skip?: number;
      take?: number;
    } = {
      orderBy,
      skip,
      take: ITEMS_PER_PAGE,
      startDate: currentMonthDates.startDate,
      endDate: currentMonthDates.endDate,
    };

    // Add filters based on budget type
    if (budget?.accountId) {
      vars.accountIds = [budget.accountId];
    }
    if (budget?.categoryId) {
      vars.categoryIds = [budget.categoryId];
    }
    if (budget?.payeeId) {
      vars.payeeIds = [budget.payeeId];
    }

    if (searchQuery) {
      vars.note = searchQuery;
    }

    return vars;
  }, [budget, sortField, sortDirection, skip, currentMonthDates, searchQuery]);

  // Fetch transactions using reportTransactions query
  const {
    data: transactionsData,
    loading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useQuery<{
    reportTransactions?: {
      items: Array<{
        id: string;
        value: number;
        date: string;
        account?: { id: string; name: string } | null;
        category?: { id: string; name: string } | null;
        payee?: { id: string; name: string } | null;
        note?: string | null;
      }>;
      totalCount: number;
    };
  }>(GET_REPORT_TRANSACTIONS, {
    variables: queryVariables,
    skip: !budget, // Skip query until budget is loaded
    errorPolicy: 'all',
  });

  const transactions = {
    items: transactionsData?.reportTransactions?.items ?? [],
    totalCount: transactionsData?.reportTransactions?.totalCount ?? 0,
    hasMore: false,
  };

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Set appbar title when budget is loaded
  useEffect(() => {
    if (budget) {
      const budgetName =
        budget.account?.name ?? budget.category?.name ?? budget.payee?.name ?? 'Budget';
      setTitle(budgetName);
    }
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [budget, setTitle]);

  const [deleteTransaction] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: [
      { query: GET_TRANSACTIONS },
      { query: GET_RECENT_TRANSACTIONS },
      { query: GET_BUDGET },
    ],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void refetchTransactions();
      void refetchBudget();
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
    []
  );

  /**
   * Handle edit click - navigate to edit page
   */
  const handleEdit = useCallback(
    (transactionId: string) => {
      if (id) {
        const returnTo = `/budgets/${id}`;
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
      void refetchBudget();
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, refetchTransactions, refetchBudget]);

  // Determine which columns to show based on budget type (before early returns)
  const showAccountColumn = budget ? !budget.accountId : true;
  const showCategoryColumn = budget ? !budget.categoryId : true;
  const showPayeeColumn = budget ? !budget.payeeId : true;

  // Determine sortable fields based on visible columns (before early returns)
  const sortableFields = useMemo<TransactionOrderByField[]>(() => {
    const fields: TransactionOrderByField[] = ['date', 'value'];
    if (showCategoryColumn) {
      fields.push('category');
    }
    if (showPayeeColumn) {
      fields.push('payee');
    }
    if (showAccountColumn) {
      fields.push('account');
    }
    return fields;
  }, [showAccountColumn, showCategoryColumn, showPayeeColumn]);

  // Show full-page loading only when budget is loading (initial load)
  if (budgetLoading) {
    return <LoadingSpinner message="Loading budget details..." />;
  }

  if (budgetError) {
    return (
      <ErrorAlert
        title="Error Loading Budget"
        message={budgetError?.message ?? 'Error loading budget details'}
      />
    );
  }

  if (!budget) {
    return (
      <ErrorAlert
        title="Budget Not Found"
        message="The requested budget could not be found."
        severity="warning"
      />
    );
  }

  // Show transaction error if any
  if (transactionsError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorAlert
          title="Error Loading Transactions"
          message={transactionsError?.message ?? 'Error loading transactions'}
        />
      </Box>
    );
  }

  return (
    <PageContainer>
      {/* Budget Summary Card */}
      <BudgetSummary budget={budget} currency={currency} />

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
          onEdit={handleEdit}
          onDelete={handleDelete}
          isSearchMode={isSearchMode}
          onClearSearch={clearSearch}
          showAccountColumn={showAccountColumn}
          showCategoryColumn={showCategoryColumn}
          showPayeeColumn={showPayeeColumn}
          sortableFields={sortableFields}
        />
      </Box>

      {/* Version History Section - pass current budget so only changed fields are shown */}
      {id ? (
        <VersionHistoryPanel
          entityType="Budget"
          entityId={id}
          currentData={budget ? (budget as unknown as Record<string, unknown>) : undefined}
        />
      ) : null}
    </PageContainer>
  );
};

BudgetDetailsPageComponent.displayName = 'BudgetDetailsPage';

export const BudgetDetailsPage = memo(BudgetDetailsPageComponent);
