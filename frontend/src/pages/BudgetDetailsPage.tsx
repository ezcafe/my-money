/**
 * Budget Details Page
 * Shows budget details with paginated transactions
 */

import React, {useState, memo, useCallback, useEffect, useRef, useMemo} from 'react';
import {useParams, useNavigate, useLocation} from 'react-router';
import {Box, Typography, LinearProgress, Chip, Stack, Grid, useTheme} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useMutation, useQuery} from '@apollo/client/react';
import {AccountBalance, Category, Person, AttachMoney, TrendingUp, TrendingDown, CheckCircle, Warning, Error as ErrorIcon} from '@mui/icons-material';
import {Card} from '../components/ui/Card';
import {useBudget} from '../hooks/useBudget';
import type {TransactionOrderInput, TransactionOrderByField} from '../hooks/useTransactions';
import {formatCurrencyPreserveDecimals} from '../utils/formatting';
import {ITEMS_PER_PAGE} from '../utils/constants';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {GET_PREFERENCES, GET_REPORT_TRANSACTIONS} from '../graphql/queries';
import {useSearch} from '../contexts/SearchContext';
import {useTitle} from '../contexts/TitleContext';
import {TransactionList} from '../components/TransactionList';

/**
 * Budget Details Page Component
 */
const BudgetDetailsPageComponent = (): React.JSX.Element => {
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

  // Theme hook (must be called before early returns)
  const theme = useTheme();

  const {budget, loading: budgetLoading, error: budgetError, refetch: refetchBudget} =
    useBudget(id);

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
        ? {field: sortField, direction: sortDirection}
        : {field: 'date', direction: 'desc'};

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
  const {data: transactionsData, loading: transactionsLoading, error: transactionsError, refetch: refetchTransactions} = useQuery<{
    reportTransactions?: {
      items: Array<{
        id: string;
        value: number;
        date: string;
        account?: {id: string; name: string} | null;
        category?: {id: string; name: string} | null;
        payee?: {id: string; name: string} | null;
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
      const budgetName = budget.account?.name ?? budget.category?.name ?? budget.payee?.name ?? 'Budget';
      setTitle(budgetName);
    }
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [budget, setTitle]);

  const [deleteTransaction] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: ['GetTransactions', 'GetRecentTransactions', 'GetBudget'],
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
    [],
  );

  /**
   * Handle edit click - navigate to edit page
   */
  const handleEdit = useCallback(
    (transactionId: string) => {
      if (id) {
        const returnTo = `/budgets/${id}`;
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
      <Box sx={{p: 2}}>
        <ErrorAlert
          title="Error Loading Transactions"
          message={transactionsError?.message ?? 'Error loading transactions'}
        />
      </Box>
    );
  }

  const budgetType = budget.accountId ? 'Account' : budget.categoryId ? 'Category' : 'Payee';

  /**
   * Get progress color based on usage percentage
   */
  const getProgressColor = (percentage: number): 'success' | 'warning' | 'error' => {
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'error';
  };

  /**
   * Get status icon based on usage percentage
   */
  const getStatusIcon = (percentage: number): React.JSX.Element => {
    if (percentage < 50) {
      return <CheckCircle sx={{color: 'success.main', fontSize: 20}} />;
    }
    if (percentage < 80) {
      return <Warning sx={{color: 'warning.main', fontSize: 20}} />;
    }
    return <ErrorIcon sx={{color: 'error.main', fontSize: 20}} />;
  };

  /**
   * Get budget type icon
   */
  const getBudgetTypeIcon = (): React.JSX.Element => {
    if (budget.accountId) {
      return <AccountBalance sx={{fontSize: 18, mr: 0.5}} />;
    }
    if (budget.categoryId) {
      return <Category sx={{fontSize: 18, mr: 0.5}} />;
    }
    return <Person sx={{fontSize: 18, mr: 0.5}} />;
  };

  const percentage = budget.percentageUsed;
  const spent = parseFloat(budget.currentSpent);
  const total = parseFloat(budget.amount);
  const remaining = total - spent;
  const progressColor = getProgressColor(percentage);
  const isOverBudget = percentage >= 100;

  return (
    <Box sx={{p: 2, width: '100%'}}>
      {/* Budget Summary Card */}
      <Card
        sx={{
          mt: 3,
          p: 3,
          mb: 2,
        }}
      >
        {/* Header Section */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{mb: 2}}>
          <Chip
            icon={getBudgetTypeIcon()}
            label={budgetType}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={getStatusIcon(percentage)}
            label={`${percentage.toFixed(1)}% Used`}
            color={progressColor}
            variant={isOverBudget ? 'filled' : 'outlined'}
            sx={{fontWeight: 'medium'}}
          />
        </Stack>

        {/* Progress Bar */}
        <Box sx={{mb: 3}}>
          <LinearProgress
            variant="determinate"
            value={Math.min(percentage, 100)}
            color={progressColor}
            sx={{
              height: 12,
              borderRadius: 1,
              backgroundColor: theme.palette.action.hover,
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
              },
            }}
          />
        </Box>

        {/* Financial Metrics Grid */}
        <Grid container spacing={2}>
          {/* Budget Amount */}
          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 0.5}}>
                <AttachMoney sx={{fontSize: 18, color: 'primary.main'}} />
                <Typography variant="caption" color="text.secondary" fontWeight="medium">
                  Budget
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight="bold" color="primary.main">
                {formatCurrencyPreserveDecimals(total, currency)}
              </Typography>
            </Box>
          </Grid>

          {/* Spent Amount */}
          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: isOverBudget
                  ? theme.palette.error.light
                  : percentage >= 80
                    ? alpha(theme.palette.warning.main, 0.12)
                    : theme.palette.action.hover,
                border: `1px solid ${
                  isOverBudget
                    ? theme.palette.error.main
                    : percentage >= 80
                      ? theme.palette.warning.main
                      : theme.palette.divider
                }`,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 0.5}}>
                <TrendingUp
                  sx={{
                    fontSize: 18,
                    color: isOverBudget
                      ? 'error.main'
                      : percentage >= 80
                        ? 'warning.main'
                        : 'text.secondary',
                  }}
                />
                <Typography
                  variant="caption"
                  color={
                    isOverBudget
                      ? 'error.main'
                      : percentage >= 80
                        ? 'warning.main'
                        : 'text.secondary'
                  }
                  fontWeight="medium"
                >
                  Spent
                </Typography>
              </Stack>
              <Typography
                variant="h6"
                fontWeight="bold"
                color={
                  isOverBudget
                    ? 'error.main'
                    : percentage >= 80
                      ? 'warning.main'
                      : 'text.primary'
                }
              >
                {formatCurrencyPreserveDecimals(spent, currency)}
              </Typography>
            </Box>
          </Grid>

          {/* Remaining Amount */}
          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor:
                  remaining >= 0
                    ? alpha(theme.palette.success.main, 0.12)
                    : theme.palette.error.light,
                border: `1px solid ${
                  remaining >= 0
                    ? theme.palette.success.main
                    : theme.palette.error.main
                }`,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 0.5}}>
                <TrendingDown
                  sx={{
                    fontSize: 18,
                    color: remaining >= 0 ? 'success.main' : 'error.main',
                  }}
                />
                <Typography
                  variant="caption"
                  color={remaining >= 0 ? 'success.main' : 'error.main'}
                  fontWeight="medium"
                >
                  Remaining
                </Typography>
              </Stack>
              <Typography
                variant="h6"
                fontWeight="bold"
                color={remaining >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrencyPreserveDecimals(remaining, currency)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
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
  );
};

BudgetDetailsPageComponent.displayName = 'BudgetDetailsPage';

export const BudgetDetailsPage = memo(BudgetDetailsPageComponent);

