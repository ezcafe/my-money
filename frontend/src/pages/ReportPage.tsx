/**
 * Report Page
 * Comprehensive reporting interface with filters, charts, and interactive results
 */

import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  Box,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Popover,
  Collapse,
  Chip,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  Clear,
  PictureAsPdf,
  CalendarToday,
  ExpandMore,
  ExpandLess,
  ShowChart,
  BarChart as BarChartIcon,
  TrendingUp,
  TrendingDown,
  Receipt,
  AttachMoney,
  AccountTree,
} from '@mui/icons-material';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, {type Dayjs} from 'dayjs';
import {useQuery, useMutation} from '@apollo/client/react';
import {useNavigate} from 'react-router';
import {LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, type TooltipProps} from 'recharts';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {TextField} from '../components/ui/TextField';
import {MultiSelect, type MultiSelectOption} from '../components/ui/MultiSelect';
import {EmptyState} from '../components/common/EmptyState';
import {formatCurrencyPreserveDecimals, formatDateShort} from '../utils/formatting';
import {validateDateRange} from '../utils/validation';
import {GET_PREFERENCES, GET_CATEGORIES, GET_PAYEES, GET_REPORT_TRANSACTIONS, GET_RECENT_TRANSACTIONS} from '../graphql/queries';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {useAccounts} from '../hooks/useAccounts';
import type {TransactionOrderInput, TransactionOrderByField} from '../hooks/useTransactions';
import {ITEMS_PER_PAGE} from '../utils/constants';
import {TransactionList} from '../components/TransactionList';
import {SankeyChart} from '../components/SankeyChart';

/**
 * Transaction type from report query
 */
interface ReportTransaction {
  id: string;
  value: number;
  date: string;
  account: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    name: string;
    type?: string;
  } | null;
  payee: {
    id: string;
    name: string;
  } | null;
  note?: string | null;
}

/**
 * Report data type
 */
interface ReportData {
  reportTransactions?: {
    items: ReportTransaction[];
    totalCount: number;
    totalAmount: number;
    totalIncome: number;
    totalExpense: number;
  };
}

/**
 * Chart data point
 */
interface ChartDataPoint {
  date: string;
  amount: number;
}

/**
 * Preset date range type
 */
type DatePreset = 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'lastMonth' | 'last30Days' | 'last90Days' | 'custom';

/**
 * Date preset configuration
 */
interface DatePresetConfig {
  label: string;
  getDates: () => {startDate: string; endDate: string};
}

/**
 * Get date presets configuration
 */
function getDatePresets(): Record<DatePreset, DatePresetConfig> {
  const today = dayjs();
  return {
    today: {
      label: 'Today',
      getDates: () => ({
        startDate: today.format('YYYY-MM-DD'),
        endDate: today.format('YYYY-MM-DD'),
      }),
    },
    thisWeek: {
      label: 'This Week',
      getDates: () => ({
        startDate: today.startOf('week').format('YYYY-MM-DD'),
        endDate: today.endOf('week').format('YYYY-MM-DD'),
      }),
    },
    thisMonth: {
      label: 'This Month',
      getDates: () => ({
        startDate: today.startOf('month').format('YYYY-MM-DD'),
        endDate: today.endOf('month').format('YYYY-MM-DD'),
      }),
    },
    thisYear: {
      label: 'This Year',
      getDates: () => ({
        startDate: today.startOf('year').format('YYYY-MM-DD'),
        endDate: today.endOf('year').format('YYYY-MM-DD'),
      }),
    },
    lastMonth: {
      label: 'Last Month',
      getDates: () => ({
        startDate: today.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        endDate: today.subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
      }),
    },
    last30Days: {
      label: 'Last 30 Days',
      getDates: () => ({
        startDate: today.subtract(30, 'day').format('YYYY-MM-DD'),
        endDate: today.format('YYYY-MM-DD'),
      }),
    },
    last90Days: {
      label: 'Last 90 Days',
      getDates: () => ({
        startDate: today.subtract(90, 'day').format('YYYY-MM-DD'),
        endDate: today.format('YYYY-MM-DD'),
      }),
    },
    custom: {
      label: 'Custom',
      getDates: () => ({
        startDate: '',
        endDate: '',
      }),
    },
  };
}

/**
 * Report Page Component
 */
export function ReportPage(): React.JSX.Element {
  const navigate = useNavigate();
  const {data: preferencesData} = useQuery<{preferences?: {currency: string}}>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';

  const {accounts} = useAccounts();
  const {data: categoriesData} = useQuery<{categories?: Array<{id: string; name: string}>}>(GET_CATEGORIES);
  const {data: payeesData} = useQuery<{payees?: Array<{id: string; name: string}>}>(GET_PAYEES);

  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData?.categories]);
  const payees = useMemo(() => payeesData?.payees ?? [], [payeesData?.payees]);

  // Filter state (current input values)
  const [filters, setFilters] = useState({
    accountIds: [] as string[],
    categoryIds: [] as string[],
    payeeIds: [] as string[],
    startDate: '',
    endDate: '',
    note: '',
  });

  // Applied filters state (used for querying)
  const [appliedFilters, setAppliedFilters] = useState({
    accountIds: [] as string[],
    categoryIds: [] as string[],
    payeeIds: [] as string[],
    startDate: '',
    endDate: '',
    note: '',
  });

  // Sorting state
  const [sortField, setSortField] = useState<TransactionOrderByField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Chart type state
  const [chartType, setChartType] = useState<'line' | 'bar' | 'sankey'>('line');

  // Pagination state
  const [page, setPage] = useState(1);


  // Date picker popover state
  const [datePickerAnchor, setDatePickerAnchor] = useState<HTMLElement | null>(null);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end' | null>(null);

  // Filter panel collapse state
  const [filterPanelExpanded, setFilterPanelExpanded] = useState<boolean>(true);

  // Date preset state
  const [datePreset, setDatePreset] = useState<DatePreset | null>(null);

  // Date picker visibility state
  const [showDatePickers, setShowDatePickers] = useState<boolean>(false);

  // Build query variables
  const queryVariables = useMemo(() => {
    const skip = (page - 1) * ITEMS_PER_PAGE;
    // Build orderBy object inside useMemo
    const orderBy: TransactionOrderInput = {
      field: sortField,
      direction: sortDirection,
    };
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
    };

    if (appliedFilters.accountIds.length > 0) {
      vars.accountIds = appliedFilters.accountIds;
    }
    if (appliedFilters.categoryIds.length > 0) {
      vars.categoryIds = appliedFilters.categoryIds;
    }
    if (appliedFilters.payeeIds.length > 0) {
      vars.payeeIds = appliedFilters.payeeIds;
    }
    if (appliedFilters.startDate) {
      vars.startDate = new Date(appliedFilters.startDate).toISOString();
    }
    if (appliedFilters.endDate) {
      // Set end date to end of day
      const endDate = new Date(appliedFilters.endDate);
      endDate.setHours(23, 59, 59, 999);
      vars.endDate = endDate.toISOString();
    }
    if (appliedFilters.note.trim()) {
      vars.note = appliedFilters.note.trim();
    }

    return vars;
  }, [appliedFilters, sortField, sortDirection, page]);

  // Check if filters are applied
  const hasFilters = useMemo(() => {
    return (
      appliedFilters.accountIds.length > 0 ||
      appliedFilters.categoryIds.length > 0 ||
      appliedFilters.payeeIds.length > 0 ||
      appliedFilters.startDate !== '' ||
      appliedFilters.endDate !== '' ||
      appliedFilters.note.trim() !== ''
    );
  }, [appliedFilters]);

  // Fetch report data
  const {data, loading, error, refetch} = useQuery<ReportData>(GET_REPORT_TRANSACTIONS, {
    variables: queryVariables,
    skip: !hasFilters, // Only fetch when filters are applied
    errorPolicy: 'all',
  });

  const transactions = useMemo(() => data?.reportTransactions?.items ?? [], [data?.reportTransactions?.items]);
  const totalCount = data?.reportTransactions?.totalCount ?? 0;
  const totalAmount = data?.reportTransactions?.totalAmount ?? 0;
  const totalIncome = data?.reportTransactions?.totalIncome ?? 0;
  const totalExpense = data?.reportTransactions?.totalExpense ?? 0;

  // Map to PaginatedTransactions format
  const paginatedTransactions = useMemo(() => ({
    items: transactions,
    totalCount,
    hasMore: false,
  }), [transactions, totalCount]);

  // Auto-collapse filter panel when data is loaded after filtering
  useEffect(() => {
    if (hasFilters && !loading && transactions.length > 0) {
      setFilterPanelExpanded(false);
    }
  }, [hasFilters, loading, transactions.length]);

  // Reset page when applied filters change
  useEffect(() => {
    setPage(1);
  }, [appliedFilters]);

  // Delete mutation
  const [deleteTransaction] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: [{query: GET_REPORT_TRANSACTIONS}, {query: GET_RECENT_TRANSACTIONS}],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void refetch();
    },
  });

  /**
   * Handle filter change
   */
  const handleFilterChange = useCallback((key: string, value: unknown): void => {
    setFilters((prev) => ({...prev, [key]: value}));
  }, []);

  /**
   * Handle date picker button click
   */
  const handleDatePickerOpen = useCallback((event: React.MouseEvent<HTMLElement>, type: 'start' | 'end') => {
    setDatePickerAnchor(event.currentTarget);
    setDatePickerType(type);
  }, []);

  /**
   * Handle date picker close
   */
  const handleDatePickerClose = useCallback(() => {
    setDatePickerAnchor(null);
    setDatePickerType(null);
  }, []);

  /**
   * Handle start date change from calendar
   */
  const handleStartDateChange = useCallback(
    (newValue: Dayjs | null) => {
      if (newValue) {
        handleFilterChange('startDate', newValue.format('YYYY-MM-DD'));
      } else {
        handleFilterChange('startDate', '');
      }
      setDatePreset('custom');
      setShowDatePickers(true);
      handleDatePickerClose();
    },
    [handleFilterChange, handleDatePickerClose],
  );

  /**
   * Handle end date change from calendar
   */
  const handleEndDateChange = useCallback(
    (newValue: Dayjs | null) => {
      if (newValue) {
        handleFilterChange('endDate', newValue.format('YYYY-MM-DD'));
      } else {
        handleFilterChange('endDate', '');
      }
      setDatePreset('custom');
      setShowDatePickers(true);
      handleDatePickerClose();
    },
    [handleFilterChange, handleDatePickerClose],
  );

  /**
   * Get formatted start date text for button
   */
  const startDateText = useMemo(() => {
    const text = filters.startDate || 'Start Date';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }, [filters.startDate]);

  /**
   * Get formatted end date text for button
   */
  const endDateText = useMemo(() => {
    const text = filters.endDate || 'End Date';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }, [filters.endDate]);

  /**
   * Apply preset date range
   */
  const handlePresetDateRange = useCallback((preset: DatePreset) => {
    if (preset === 'custom') {
      setShowDatePickers(true);
      setDatePreset('custom');
    } else {
      const presets = getDatePresets();
      const presetConfig = presets[preset];
      if (presetConfig) {
        const dates = presetConfig.getDates();
        setFilters((prev) => ({
          ...prev,
          startDate: dates.startDate,
          endDate: dates.endDate,
        }));
        setDatePreset(preset);
        setShowDatePickers(false);
      }
    }
  }, []);

  /**
   * Apply filters - copy current filter inputs to applied filters
   */
  const handleApplyFilters = useCallback((): void => {
    setAppliedFilters({...filters});
    // Only collapse if there are filter criteria applied
    const hasFilterCriteria =
      filters.accountIds.length > 0 ||
      filters.categoryIds.length > 0 ||
      filters.payeeIds.length > 0 ||
      filters.startDate !== '' ||
      filters.endDate !== '' ||
      filters.note.trim() !== '';
    if (hasFilterCriteria) {
      setFilterPanelExpanded(false);
    }
  }, [filters]);

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback((): void => {
    const emptyFilters = {
      accountIds: [] as string[],
      categoryIds: [] as string[],
      payeeIds: [] as string[],
      startDate: '',
      endDate: '',
      note: '',
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setDatePreset(null);
    setShowDatePickers(false);
    setFilterPanelExpanded(true);
  }, []);

  /**
   * Calculate summary statistics
   * Uses backend-calculated totalIncome and totalExpense for accuracy across all filtered transactions
   */
  const summaryStats = useMemo(() => {
    if (totalCount === 0) {
      return {
        totalAmount: 0,
        transactionCount: 0,
        averageAmount: 0,
        income: 0,
        expense: 0,
      };
    }

    // Use backend-calculated values for income and expense (from all filtered transactions)
    // Calculate average from paginated transactions for display
    const averageAmount = transactions.length > 0
      ? transactions.reduce((sum, t) => sum + Number(t.value), 0) / transactions.length
      : 0;

    return {
      totalAmount,
      transactionCount: totalCount,
      averageAmount,
      income: totalIncome,
      expense: totalExpense,
    };
  }, [transactions, totalCount, totalAmount, totalIncome, totalExpense, page]);

  /**
   * Get active filter chips
   */
  const activeFilters = useMemo(() => {
    const chips: Array<{label: string; onDelete: () => void}> = [];

    if (appliedFilters.startDate && appliedFilters.endDate) {
      chips.push({
        label: `${formatDateShort(appliedFilters.startDate)} - ${formatDateShort(appliedFilters.endDate)}`,
        onDelete: () => {
          setFilters((prev) => ({...prev, startDate: '', endDate: ''}));
          setAppliedFilters((prev) => ({...prev, startDate: '', endDate: ''}));
          setDatePreset(null);
          setShowDatePickers(false);
        },
      });
    }

    appliedFilters.accountIds.forEach((id) => {
      const account = accounts.find((a) => a.id === id);
      if (account) {
        chips.push({
          label: `Account: ${account.name}`,
          onDelete: () => {
            const newIds = appliedFilters.accountIds.filter((aid) => aid !== id);
            setFilters((prev) => ({...prev, accountIds: newIds}));
            setAppliedFilters((prev) => ({...prev, accountIds: newIds}));
          },
        });
      }
    });

    appliedFilters.categoryIds.forEach((id) => {
      const category = categories.find((c) => c.id === id);
      if (category) {
        chips.push({
          label: `Category: ${category.name}`,
          onDelete: () => {
            const newIds = appliedFilters.categoryIds.filter((cid) => cid !== id);
            setFilters((prev) => ({...prev, categoryIds: newIds}));
            setAppliedFilters((prev) => ({...prev, categoryIds: newIds}));
          },
        });
      }
    });

    appliedFilters.payeeIds.forEach((id) => {
      const payee = payees.find((p) => p.id === id);
      if (payee) {
        chips.push({
          label: `Payee: ${payee.name}`,
          onDelete: () => {
            const newIds = appliedFilters.payeeIds.filter((pid) => pid !== id);
            setFilters((prev) => ({...prev, payeeIds: newIds}));
            setAppliedFilters((prev) => ({...prev, payeeIds: newIds}));
          },
        });
      }
    });

    if (appliedFilters.note.trim()) {
      chips.push({
        label: `Note: ${appliedFilters.note.trim()}`,
        onDelete: () => {
          setFilters((prev) => ({...prev, note: ''}));
          setAppliedFilters((prev) => ({...prev, note: ''}));
        },
      });
    }

    return chips;
  }, [appliedFilters, accounts, categories, payees]);

  /**
   * Custom chart tooltip formatter
   */
  const CustomTooltip = useCallback(
    ({active, payload}: TooltipProps<number, string>) => {
      if (active && payload && payload.length > 0) {
        const data = payload[0];
        if (!data) {
          return null;
        }
        const payloadData = data.payload as ChartDataPoint | undefined;
        const date = payloadData?.date ?? '';
        return (
          <Box
            sx={{
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
              boxShadow: 2,
            }}
          >
            <Typography variant="body2" sx={{mb: 0.5}}>
              <strong>{date}</strong>
            </Typography>
            <Typography variant="body2" color="primary">
              {formatCurrencyPreserveDecimals(data.value ?? 0, currency)}
            </Typography>
          </Box>
        );
      }
      return null;
    },
    [currency],
  );

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
      void navigate(`/transactions/${transactionId}/edit?returnTo=${encodeURIComponent('/report')}`);
    },
    [navigate],
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

  /**
   * Handle row click - navigate to edit page
   */
  const handleRowClick = useCallback(
    (transactionId: string) => {
      void navigate(`/transactions/${transactionId}/edit?returnTo=${encodeURIComponent('/report')}`);
    },
    [navigate],
  );

  /**
   * Prepare chart data
   */
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (transactions.length === 0) {
      return [];
    }

    // Group transactions by date
    const groupedByDate = new Map<string, number>();
    for (const transaction of transactions) {
      const dateKey = formatDateShort(transaction.date);
      const current = groupedByDate.get(dateKey) ?? 0;
      groupedByDate.set(dateKey, current + Number(transaction.value));
    }

    // Convert to array and sort by date
    const dataPoints: ChartDataPoint[] = Array.from(groupedByDate.entries())
      .map(([date, amount]) => ({date, amount}))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return dataPoints;
  }, [transactions]);

  /**
   * Format Y-axis tick values with abbreviation
   */
  const formatYAxisTick = useCallback((value: unknown): string => {
    const numValue = typeof value === 'number' ? value : Number(value);
    if (typeof numValue !== 'number' || Number.isNaN(numValue) || !Number.isFinite(numValue)) {
      return '';
    }
    const absValue = Math.abs(numValue);
    const sign = numValue < 0 ? '-' : '';
    if (absValue >= 1_000_000_000) {
      return `${sign}${(absValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    }
    if (absValue >= 1_000_000) {
      return `${sign}${(absValue / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (absValue >= 1_000) {
      return `${sign}${(absValue / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    }
    return String(numValue);
  }, []);

  /**
   * Prepare Sankey diagram data
   */
  const sankeyData = useMemo(() => {
    if (transactions.length === 0) {
      return null;
    }

    // Separate income and expense transactions
    const incomeTransactions = transactions.filter(
      (t) => t.category?.type === 'INCOME',
    );
    const expenseTransactions = transactions.filter(
      (t) => !t.category || t.category.type === 'EXPENSE',
    );

    // Build node map and links
    const nodeMap = new Map<string, number>();
    const links: Array<{source: string; target: string; value: number}> = [];

    // Process income: Account -> Payee -> Budget
    const incomeByAccountPayee = new Map<string, Map<string, number>>();
    let totalIncome = 0;

    for (const transaction of incomeTransactions) {
      const accountName = transaction.account?.name ?? 'Unknown Account';
      const payeeName = transaction.payee?.name ?? 'Others';
      const value = Number(transaction.value);

      if (!incomeByAccountPayee.has(accountName)) {
        incomeByAccountPayee.set(accountName, new Map());
      }
      const payeeMap = incomeByAccountPayee.get(accountName)!;
      payeeMap.set(payeeName, (payeeMap.get(payeeName) ?? 0) + value);
      totalIncome += value;
    }

    // Create nodes and links for income flow
    for (const [accountName, payeeMap] of incomeByAccountPayee.entries()) {
      const accountNodeId = `account_${accountName}`;
      nodeMap.set(accountNodeId, (nodeMap.get(accountNodeId) ?? 0) + Array.from(payeeMap.values()).reduce((sum, val) => sum + val, 0));

      for (const [payeeName, value] of payeeMap.entries()) {
        const payeeNodeId = `payee_income_${accountName}_${payeeName}`;
        nodeMap.set(payeeNodeId, (nodeMap.get(payeeNodeId) ?? 0) + value);

        // Link: Account -> Payee
        links.push({
          source: accountNodeId,
          target: payeeNodeId,
          value,
        });

        // Link: Payee -> Budget
        links.push({
          source: payeeNodeId,
          target: 'budget',
          value,
        });
      }
    }

    // Budget node
    nodeMap.set('budget', totalIncome);

    // Process expenses: Budget -> Category -> Payee
    const expenseByCategoryPayee = new Map<string, Map<string, number>>();

    for (const transaction of expenseTransactions) {
      const categoryName = transaction.category?.name ?? 'Uncategorized';
      const payeeName = transaction.payee?.name ?? 'Others';
      const value = Math.abs(Number(transaction.value));

      if (!expenseByCategoryPayee.has(categoryName)) {
        expenseByCategoryPayee.set(categoryName, new Map());
      }
      const payeeMap = expenseByCategoryPayee.get(categoryName)!;
      payeeMap.set(payeeName, (payeeMap.get(payeeName) ?? 0) + value);
    }

    // Create nodes and links for expense flow
    for (const [categoryName, payeeMap] of expenseByCategoryPayee.entries()) {
      const categoryNodeId = `category_${categoryName}`;
      const categoryTotal = Array.from(payeeMap.values()).reduce((sum, val) => sum + val, 0);
      nodeMap.set(categoryNodeId, (nodeMap.get(categoryNodeId) ?? 0) + categoryTotal);

      // Link: Budget -> Category
      links.push({
        source: 'budget',
        target: categoryNodeId,
        value: categoryTotal,
      });

      for (const [payeeName, value] of payeeMap.entries()) {
        const payeeNodeId = `payee_expense_${categoryName}_${payeeName}`;
        nodeMap.set(payeeNodeId, (nodeMap.get(payeeNodeId) ?? 0) + value);

        // Link: Category -> Payee
        links.push({
          source: categoryNodeId,
          target: payeeNodeId,
          value,
        });
      }
    }

    // Convert node map to array with labels
    const nodeLabels: string[] = [];
    const nodeValues: number[] = [];
    const nodeIdToIndex = new Map<string, number>();

    // Add nodes in order: Earnings (Account -> Payee), Budget, Categories, Spendings
    let nodeIndex = 0;

    // Earnings: Accounts
    for (const [accountName] of incomeByAccountPayee.entries()) {
      const nodeId = `account_${accountName}`;
      nodeIdToIndex.set(nodeId, nodeIndex);
      nodeLabels.push(accountName);
      nodeValues.push(nodeMap.get(nodeId) ?? 0);
      nodeIndex++;
    }

    // Earnings: Payees
    for (const [accountName, payeeMap] of incomeByAccountPayee.entries()) {
      for (const [payeeName] of payeeMap.entries()) {
        const nodeId = `payee_income_${accountName}_${payeeName}`;
        nodeIdToIndex.set(nodeId, nodeIndex);
        nodeLabels.push(payeeName);
        nodeValues.push(nodeMap.get(nodeId) ?? 0);
        nodeIndex++;
      }
    }

    // Budget
    nodeIdToIndex.set('budget', nodeIndex);
    nodeLabels.push(`Budget (${formatCurrencyPreserveDecimals(totalIncome, currency)})`);
    nodeValues.push(totalIncome);
    nodeIndex++;

    // Categories
    for (const [categoryName] of expenseByCategoryPayee.entries()) {
      const nodeId = `category_${categoryName}`;
      nodeIdToIndex.set(nodeId, nodeIndex);
      nodeLabels.push(categoryName);
      nodeValues.push(nodeMap.get(nodeId) ?? 0);
      nodeIndex++;
    }

    // Spendings: Payees
    for (const [categoryName, payeeMap] of expenseByCategoryPayee.entries()) {
      for (const [payeeName] of payeeMap.entries()) {
        const nodeId = `payee_expense_${categoryName}_${payeeName}`;
        nodeIdToIndex.set(nodeId, nodeIndex);
        nodeLabels.push(payeeName);
        nodeValues.push(nodeMap.get(nodeId) ?? 0);
        nodeIndex++;
      }
    }

    // Convert links to indices
    const linkSources: number[] = [];
    const linkTargets: number[] = [];
    const linkValues: number[] = [];

    for (const link of links) {
      const sourceIdx = nodeIdToIndex.get(link.source);
      const targetIdx = nodeIdToIndex.get(link.target);
      if (sourceIdx !== undefined && targetIdx !== undefined) {
        linkSources.push(sourceIdx);
        linkTargets.push(targetIdx);
        linkValues.push(link.value);
      }
    }

    return {
      node: {
        label: nodeLabels,
        pad: 15,
        thickness: 20,
        line: {
          color: 'black',
          width: 0.5,
        },
      },
      link: {
        source: linkSources,
        target: linkTargets,
        value: linkValues,
      },
    };
  }, [transactions, currency]);

  /**
   * Generate and download PDF
   */
  const handleDownloadPDF = useCallback(() => {
    const doc = new jsPDF();
    const margin = 20;
    let yPosition = margin;

    // Title
    doc.setFontSize(18);
    doc.text('Transaction Report', margin, yPosition);
    yPosition += 10;

    // Date range
    doc.setFontSize(12);
    if (appliedFilters.startDate || appliedFilters.endDate) {
      const dateRange = `${appliedFilters.startDate || 'Start'} to ${appliedFilters.endDate || 'End'}`;
      doc.text(`Date Range: ${dateRange}`, margin, yPosition);
      yPosition += 8;
    }

    // Filters summary
    const filterSummary: string[] = [];
    if (appliedFilters.accountIds.length > 0) {
      const accountNames = appliedFilters.accountIds
        .map((id) => accounts.find((a) => a.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      filterSummary.push(`Accounts: ${accountNames}`);
    }
    if (appliedFilters.categoryIds.length > 0) {
      const categoryNames = appliedFilters.categoryIds
        .map((id) => categories.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      filterSummary.push(`Categories: ${categoryNames}`);
    }
    if (appliedFilters.payeeIds.length > 0) {
      const payeeNames = appliedFilters.payeeIds
        .map((id) => payees.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      filterSummary.push(`Payees: ${payeeNames}`);
    }
    if (appliedFilters.note.trim()) {
      filterSummary.push(`Note: ${appliedFilters.note.trim()}`);
    }

    if (filterSummary.length > 0) {
      doc.setFontSize(10);
      filterSummary.forEach((summary) => {
        doc.text(summary, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 4;
    }

    // Summary stats
    doc.setFontSize(12);
    doc.text(`Total Transactions: ${totalCount}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Total Amount: ${formatCurrencyPreserveDecimals(totalAmount, currency)}`, margin, yPosition);
    yPosition += 15;

    // Table data
    const tableData = transactions.map((t) => [
      formatDateShort(t.date),
      formatCurrencyPreserveDecimals(t.value, currency),
      t.account?.name ?? '-',
      t.category?.name ?? '-',
      t.payee?.name ?? '-',
      t.note ?? '-',
    ]);

    // Add table
    autoTable(doc, {
      head: [['Date', 'Value', 'Account', 'Category', 'Payee', 'Note']],
      body: tableData,
      startY: yPosition,
      margin: {left: margin, right: margin},
      styles: {fontSize: 8},
      headStyles: {fillColor: [66, 66, 66]},
    });

    // Save PDF
    const filename = `report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }, [transactions, appliedFilters, accounts, categories, payees, totalCount, totalAmount, currency]);

  // Validation error
  const validationError = useMemo(() => {
    if (filters.startDate && filters.endDate) {
      if (!validateDateRange(filters.startDate, filters.endDate)) {
        return 'End date must be after start date';
      }
    }
    return null;
  }, [filters.startDate, filters.endDate]);

  // Prepare multi-select options
  const accountOptions: MultiSelectOption[] = useMemo(
    () => accounts.map((a) => ({id: a.id, name: a.name})),
    [accounts],
  );
  const categoryOptions: MultiSelectOption[] = useMemo(
    () => categories.map((c) => ({id: c.id, name: c.name})),
    [categories],
  );
  const payeeOptions: MultiSelectOption[] = useMemo(
    () => payees.map((p) => ({id: p.id, name: p.name})),
    [payees],
  );

  const datePresets = getDatePresets();

  return (
    <Box sx={{maxWidth: '1400px', mx: 'auto'}}>
      {/* Filters Section */}
      <Card sx={{p: 3, mb: 3}}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setFilterPanelExpanded(!filterPanelExpanded)}
        >
          <Typography variant="h6" component="h2">Filters</Typography>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setFilterPanelExpanded(!filterPanelExpanded);
            }}
          >
            {filterPanelExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        <Collapse in={filterPanelExpanded}>
          <Box sx={{mt: 2}}>
            {validationError && (
              <Box sx={{mb: 2, color: 'error.main'}}>
                <Typography variant="body2" color="error">
                  {validationError}
                </Typography>
              </Box>
            )}
            {error && (
              <Box sx={{mb: 2, color: 'error.main'}}>
                <Typography variant="body2" color="error">
                  {error?.message ?? 'Error loading report data'}
                </Typography>
              </Box>
            )}

            {/* Quick Date Presets */}
            <Box sx={{mb: 3}}>
              <Typography variant="subtitle2" sx={{mb: 1, color: 'text.secondary'}}>
                Quick Date Ranges
              </Typography>
              <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                {(['today', 'thisWeek', 'thisMonth', 'thisYear', 'lastMonth', 'last30Days', 'last90Days', 'custom'] as DatePreset[]).map((preset) => (
                  <Button
                    key={preset}
                    variant={datePreset === preset ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => handlePresetDateRange(preset)}
                    sx={{textTransform: 'none'}}
                  >
                    {datePresets[preset].label}
                  </Button>
                ))}
              </Box>
            </Box>

            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
              {/* Date Range - Two Separate Buttons */}
              {showDatePickers && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      onClick={(e) => handleDatePickerOpen(e, 'start')}
                      startIcon={<CalendarToday />}
                      fullWidth
                      sx={{justifyContent: 'flex-start', textTransform: 'none'}}
                    >
                      {startDateText}
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      onClick={(e) => handleDatePickerOpen(e, 'end')}
                      startIcon={<CalendarToday />}
                      fullWidth
                      sx={{justifyContent: 'flex-start', textTransform: 'none'}}
                    >
                      {endDateText}
                    </Button>
                  </Grid>
                </Grid>
              )}

              {/* Multi-select Filters */}
              <MultiSelect
                label="Account"
                options={accountOptions}
                value={filters.accountIds}
                onChange={(value) => handleFilterChange('accountIds', value)}
              />
              <MultiSelect
                label="Payee"
                options={payeeOptions}
                value={filters.payeeIds}
                onChange={(value) => handleFilterChange('payeeIds', value)}
              />
              <MultiSelect
                label="Category"
                options={categoryOptions}
                value={filters.categoryIds}
                onChange={(value) => handleFilterChange('categoryIds', value)}
              />

              {/* Note Search */}
              <TextField
                label="Note"
                value={filters.note}
                onChange={(e) => handleFilterChange('note', e.target.value)}
                placeholder="Search transactions by note..."
                fullWidth
              />

              {/* Apply Button */}
              <Button
                variant="contained"
                onClick={handleApplyFilters}
                fullWidth
                sx={{textTransform: 'none', mt: 1}}
              >
                Apply Filters
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Card>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <Card sx={{p: 3, mb: 3}}>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
            <Typography variant="subtitle2" sx={{mr: 1, color: 'text.secondary'}}>
              Active Filters:
            </Typography>
            {activeFilters.map((filter, index) => (
              <Chip
                key={index}
                label={filter.label}
                onDelete={filter.onDelete}
                size="small"
                sx={{textTransform: 'none'}}
              />
            ))}
            <Button
              variant="text"
              size="small"
              onClick={handleClearFilters}
              startIcon={<Clear />}
              sx={{textTransform: 'none', ml: 'auto'}}
            >
              Clear All
            </Button>
          </Box>
        </Card>
      )}

      {/* Summary Cards */}
      {hasFilters && totalCount > 0 && (
        <Grid container spacing={2} sx={{mb: 3}}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{p: 3, height: '100%'}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                <AttachMoney color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Amount
                </Typography>
              </Box>
              <Typography variant="h5" sx={{fontWeight: 600}}>
                {formatCurrencyPreserveDecimals(summaryStats.totalAmount, currency)}
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{p: 3, height: '100%'}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                <TrendingUp sx={{color: 'success.main'}} />
                <Typography variant="subtitle2" color="text.secondary">
                  Income
                </Typography>
              </Box>
              <Typography variant="h5" sx={{fontWeight: 600, color: 'success.main'}}>
                {formatCurrencyPreserveDecimals(summaryStats.income, currency)}
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{p: 3, height: '100%'}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                <TrendingDown sx={{color: 'error.main'}} />
                <Typography variant="subtitle2" color="text.secondary">
                  Expenses
                </Typography>
              </Box>
              <Typography variant="h5" sx={{fontWeight: 600, color: 'error.main'}}>
                {formatCurrencyPreserveDecimals(summaryStats.expense, currency)}
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{p: 3, height: '100%'}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                <Receipt color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Transactions
                </Typography>
              </Box>
              <Typography variant="h5" sx={{fontWeight: 600}}>
                {summaryStats.transactionCount.toLocaleString()}
              </Typography>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Actions Card */}
      {hasFilters && transactions.length > 0 && (
        <Card sx={{p: 3, mb: 3}}>
          <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
            <Button variant="contained" onClick={handleDownloadPDF} startIcon={<PictureAsPdf />} sx={{textTransform: 'none'}}>
              Download PDF
            </Button>
          </Box>
        </Card>
      )}

      {/* Chart Section */}
      {hasFilters && !loading && transactions.length > 0 && ((chartType !== 'sankey' && chartData.length > 0) || (chartType === 'sankey' && sankeyData !== null)) && (
        <Card sx={{p: 3, mb: 3}}>
          <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
            <Typography variant="h6" component="h2">
              {chartType === 'sankey' ? 'Cash Flow' : 'Transaction Trends'}
            </Typography>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => {
                if (value !== null && (value === 'line' || value === 'bar' || value === 'sankey')) {
                  setChartType(value as 'line' | 'bar' | 'sankey');
                }
              }}
              size="small"
            >
              <ToggleButton value="line" aria-label="Line chart">
                <ShowChart />
              </ToggleButton>
              <ToggleButton value="bar" aria-label="Bar chart">
                <BarChartIcon />
              </ToggleButton>
              <ToggleButton value="sankey" aria-label="Cash flow chart">
                <AccountTree />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box>
            {chartType === 'sankey' ? (
              sankeyData && (
                <SankeyChart data={sankeyData} width={800} height={400} currency={currency} />
              )
            ) : (
              <Box sx={{width: '100%', height: 400, overflow: 'auto'}}>
                {chartType === 'line' ? (
                  <LineChart width={800} height={400} data={chartData} style={{minWidth: 800}}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={formatYAxisTick} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="amount" stroke="#8884d8" name="Amount" strokeWidth={2} />
                  </LineChart>
                ) : (
                  <BarChart width={800} height={400} data={chartData} style={{minWidth: 800}}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={formatYAxisTick} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" fill="#8884d8" name="Amount" />
                  </BarChart>
                )}
              </Box>
            )}
          </Box>
        </Card>
      )}

      {/* Results Section */}
      {!hasFilters ? (
        <EmptyState
          icon={<Receipt />}
          title="Get Started with Reports"
          description="Select a date range and apply filters to generate a comprehensive report of your transactions. You can filter by accounts, categories, payees, and search by notes."
        />
      ) : loading ? (
        <Card sx={{p: 4}}>
          <Box sx={{py: 4, textAlign: 'center'}}>
            <CircularProgress sx={{mb: 2}} />
            <Typography variant="body2" color="text.secondary">
              Loading transactions...
            </Typography>
          </Box>
        </Card>
      ) : totalCount === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No Transactions Found"
          description="No transactions match your current filters. Try adjusting your date range or filter criteria."
          action={
            <Button variant="outlined" onClick={handleClearFilters} startIcon={<Clear />} sx={{textTransform: 'none'}}>
              Clear Filters
            </Button>
          }
        />
      ) : (
        <TransactionList
          transactions={paginatedTransactions}
          loading={loading}
          error={error}
          currency={currency}
          page={page}
          onPageChange={setPage}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isSearchMode={false}
          showAccountColumn={true}
          showCategoryColumn={true}
          showPayeeColumn={true}
          sortableFields={['date', 'value', 'account', 'category', 'payee']}
          onRowClick={handleRowClick}
        />
      )}

      {/* Date Picker Popover */}
      <Popover
        open={Boolean(datePickerAnchor)}
        anchorEl={datePickerAnchor}
        onClose={handleDatePickerClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: datePickerType === 'start' ? 'left' : 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: datePickerType === 'start' ? 'left' : 'right',
        }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{display: 'flex', flexDirection: 'column', p: 2}}>
            {datePickerType === 'start' && (
              <DateCalendar
                value={filters.startDate ? dayjs(filters.startDate) : null}
                onChange={handleStartDateChange}
                views={['year', 'month', 'day']}
              />
            )}
            {datePickerType === 'end' && (
              <DateCalendar
                value={filters.endDate ? dayjs(filters.endDate) : null}
                onChange={handleEndDateChange}
                views={['year', 'month', 'day']}
              />
            )}
          </Box>
        </LocalizationProvider>
      </Popover>
    </Box>
  );
}
