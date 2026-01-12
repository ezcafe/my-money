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
  useTheme,
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
  DonutLarge,
  Layers,
  Timeline,
} from '@mui/icons-material';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, {type Dayjs} from 'dayjs';
import {useQuery, useMutation} from '@apollo/client/react';
import {useNavigate} from 'react-router';
import {LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, type TooltipProps} from 'recharts';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {TextField} from '../components/ui/TextField';
import {MultiSelect, type MultiSelectOption} from '../components/ui/MultiSelect';
import {EmptyState} from '../components/common/EmptyState';
import {formatCurrencyPreserveDecimals, formatDateShort, formatNumberAbbreviation} from '../utils/formatting';
import type {DateFormat} from '../contexts/DateFormatContext';
import {validateDateRange} from '../utils/validation';
import {GET_PREFERENCES, GET_CATEGORIES, GET_PAYEES, GET_REPORT_TRANSACTIONS, GET_RECENT_TRANSACTIONS, GET_BUDGETS} from '../graphql/queries';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {useAccounts} from '../hooks/useAccounts';
import {useDateFormat} from '../hooks/useDateFormat';
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
 * Chart data point with dynamic series keys
 */
interface ChartDataPoint {
  date: string;
  originalDate?: string;
  [key: string]: string | number | undefined; // Dynamic keys for payee-category combinations
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
 * Determine date grouping type based on date filter
 * @param startDate - Start date string (YYYY-MM-DD)
 * @param endDate - End date string (YYYY-MM-DD)
 * @returns 'month' | 'week' | 'date'
 */
function getDateGroupingType(startDate: string, endDate: string): 'month' | 'week' | 'date' {
  if (!startDate || !endDate) {
    return 'month'; // Default to month if no filter
  }

  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const diffMonths = end.diff(start, 'month', true);

  if (diffMonths >= 1) {
    return 'month';
  }

  const diffWeeks = end.diff(start, 'week', true);
  if (diffWeeks >= 1) {
    return 'week';
  }

  return 'date';
}

/**
 * Get group key for a date based on grouping type
 * @param date - Date string (YYYY-MM-DD)
 * @param groupingType - Grouping type ('month' | 'week' | 'date')
 * @param dateFormat - Date format for date-level grouping
 * @returns Group key string
 */
function getGroupKey(date: string, groupingType: 'month' | 'week' | 'date', dateFormat: DateFormat): string {
  const dateObj = dayjs(date);

  switch (groupingType) {
    case 'month':
      return dateObj.format('YYYY-MM');
    case 'week':
      // Use start of week as the key for consistent grouping
      return dateObj.startOf('week').format('YYYY-MM-DD');
    case 'date':
      return formatDateShort(date, dateFormat);
    default:
      return dateObj.format('YYYY-MM');
  }
}

/**
 * Report Page Component
 */
export function ReportPage(): React.JSX.Element {
  const navigate = useNavigate();
  const theme = useTheme();
  const {data: preferencesData} = useQuery<{preferences?: {currency: string}}>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';

  const {accounts} = useAccounts();
  const {dateFormat} = useDateFormat();
  const {data: categoriesData} = useQuery<{categories?: Array<{id: string; name: string}>}>(GET_CATEGORIES);
  const {data: payeesData} = useQuery<{payees?: Array<{id: string; name: string}>}>(GET_PAYEES);
  const {data: budgetsData} = useQuery<{budgets?: Array<{id: string; amount: string; currentSpent: string; categoryId: string | null; category: {id: string; name: string} | null}>}>(GET_BUDGETS);

  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData?.categories]);
  const payees = useMemo(() => payeesData?.payees ?? [], [payeesData?.payees]);
  const budgets = useMemo(() => budgetsData?.budgets ?? [], [budgetsData?.budgets]);

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
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie' | 'sankey' | 'stacked'>('line');

  // Chart series visibility state (track which series are hidden)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

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
  }, [transactions, totalCount, totalAmount, totalIncome, totalExpense]);

  /**
   * Get active filter chips
   */
  const activeFilters = useMemo(() => {
    const chips: Array<{label: string; onDelete: () => void}> = [];

    if (appliedFilters.startDate && appliedFilters.endDate) {
      chips.push({
        label: `${formatDateShort(appliedFilters.startDate, dateFormat)} - ${formatDateShort(appliedFilters.endDate, dateFormat)}`,
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
  }, [appliedFilters, accounts, categories, payees, dateFormat]);

  /**
   * Format currency with abbreviation (B, M, K)
   * @param value - The numeric value to format
   * @param currencyCode - The currency code
   * @returns Formatted currency string with abbreviation
   */
  const formatCurrencyAbbreviated = useCallback((value: number, currencyCode: string): string => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    let abbreviation = '';
    let formattedValue = value;

    if (absValue >= 1_000_000_000) {
      formattedValue = absValue / 1_000_000_000;
      abbreviation = 'B';
    } else if (absValue >= 1_000_000) {
      formattedValue = absValue / 1_000_000;
      abbreviation = 'M';
    } else if (absValue >= 1_000) {
      formattedValue = absValue / 1_000;
      abbreviation = 'K';
    }

    if (abbreviation) {
      const formatted = formattedValue.toFixed(1).replace(/\.0$/, '');
      // Get currency symbol
      const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      const symbol = currencyFormatter.format(0).replace(/[\d\s,.-]/g, '');
      return `${sign}${symbol}${formatted}${abbreviation}`;
    }

    return formatCurrencyPreserveDecimals(value, currencyCode);
  }, []);

  /**
   * Prepare chart data for line chart showing income and expense lines
   * Groups by month/week/date based on date filter range
   */
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (transactions.length === 0) {
      return [];
    }

    // Determine date grouping type
    const groupingType = getDateGroupingType(appliedFilters.startDate, appliedFilters.endDate);

    // Separate income and expense transactions
    const incomeTransactions = transactions.filter((t) => t.category?.type === 'INCOME');
    const expenseTransactions = transactions.filter((t) => !t.category || t.category.type === 'EXPENSE');

    // Group by date period
    // Structure: Map<groupKey, {income: number, expense: number}>
    const groupedData = new Map<string, {income: number; expense: number; originalDate: string}>();

    // Process income transactions
    for (const transaction of incomeTransactions) {
      const groupKey = getGroupKey(transaction.date, groupingType, dateFormat);
      const existing = groupedData.get(groupKey) ?? {income: 0, expense: 0, originalDate: transaction.date};
      existing.income += Number(transaction.value);
      groupedData.set(groupKey, existing);
    }

    // Process expense transactions
    for (const transaction of expenseTransactions) {
      const groupKey = getGroupKey(transaction.date, groupingType, dateFormat);
      const existing = groupedData.get(groupKey) ?? {income: 0, expense: 0, originalDate: transaction.date};
      existing.expense += Math.abs(Number(transaction.value));
      groupedData.set(groupKey, existing);
    }

    // Convert to array and format dates
    const dataPoints: ChartDataPoint[] = Array.from(groupedData.entries())
      .map(([, data]) => {
        // Format the group key for display
        let formattedDate: string;
        if (groupingType === 'month') {
          const dateObj = dayjs(data.originalDate);
          formattedDate = dateObj.format('MMM YYYY');
        } else if (groupingType === 'week') {
          const dateObj = dayjs(data.originalDate);
          const weekStart = dateObj.startOf('week');
          const weekEnd = dateObj.endOf('week');
          formattedDate = `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`;
        } else {
          formattedDate = formatDateShort(data.originalDate, dateFormat);
        }

        return {
          date: formattedDate,
          originalDate: data.originalDate,
          income: data.income,
          expense: data.expense,
        };
      })
      .sort((a, b) => new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime());

    return dataPoints;
  }, [transactions, appliedFilters.startDate, appliedFilters.endDate, dateFormat]);

  /**
   * Get series keys from chart data
   */
  const chartSeriesKeys = useMemo(() => {
    if (chartData.length === 0) {
      return [];
    }
    const keys = new Set<string>();
    for (const dataPoint of chartData) {
      for (const key in dataPoint) {
        if (key !== 'date' && key !== 'originalDate' && typeof dataPoint[key] === 'number') {
          keys.add(key);
        }
      }
    }
    return Array.from(keys);
  }, [chartData]);

  /**
   * Reset hidden series when chart data changes significantly
   * (when series keys change, clean up hidden state for non-existent keys)
   */
  const chartSeriesKeysString = chartSeriesKeys.join(',');
  useEffect(() => {
    setHiddenSeries((prev) => {
      const newSet = new Set<string>();
      for (const key of prev) {
        if (chartSeriesKeys.includes(key)) {
          newSet.add(key);
        }
      }
      return newSet;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartSeriesKeysString]); // Reset when series keys change

  /**
   * Generate color palette for chart series
   * Uses a diverse, colorblind-friendly palette optimized for data visualization
   */
  const getSeriesColor = useCallback((index: number): string => {
    // Professional color palette for financial charts
    // Colors are distinct, colorblind-friendly, and work well for data visualization
    const colors: string[] = [
      '#2196F3', // Blue
      '#4CAF50', // Green
      '#FF9800', // Orange
      '#F44336', // Red
      '#9C27B0', // Purple
      '#00BCD4', // Cyan
      '#FFC107', // Amber
      '#795548', // Brown
      '#E91E63', // Pink
      '#3F51B5', // Indigo
      '#009688', // Teal
      '#FF5722', // Deep Orange
      '#673AB7', // Deep Purple
      '#8BC34A', // Light Green
      '#FFEB3B', // Yellow
      '#607D8B', // Blue Grey
    ];
    // Cycle through colors
    return colors[index % colors.length] ?? '#2196F3';
  }, []);

  /**
   * Toggle series visibility when legend item is clicked
   */
  const handleLegendClick = useCallback((dataKey: string) => {
    setHiddenSeries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
    });
  }, []);

  /**
   * Custom chart tooltip formatter for multiple series
   */
  const CustomTooltip = useCallback(
    ({active, payload}: TooltipProps<number, string>) => {
      if (active && payload && payload.length > 0) {
        const payloadData = payload[0]?.payload as ChartDataPoint | undefined;
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
            <Typography variant="body2" sx={{mb: 1}}>
              <strong>{date}</strong>
            </Typography>
            {payload.map((entry, index) => {
              if (!entry?.value) {
                return null;
              }
              return (
                <Typography
                  key={index}
                  variant="body2"
                  sx={{color: entry.color, mb: 0.5}}
                >
                  {entry.name}: {formatCurrencyAbbreviated(Number(entry.value), currency)}
                </Typography>
              );
            })}
          </Box>
        );
      }
      return null;
    },
    [currency, formatCurrencyAbbreviated],
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
   * Format Y-axis tick values with abbreviation
   */
  const formatYAxisTick = useCallback((value: unknown): string => {
    const numValue = typeof value === 'number' ? value : Number(value);
    if (typeof numValue !== 'number' || Number.isNaN(numValue) || !Number.isFinite(numValue)) {
      return '';
    }
    return formatNumberAbbreviation(numValue);
  }, []);

  /**
   * Prepare pie chart data - always group by categories
   */
  const pieChartData = useMemo(() => {
    if (transactions.length === 0) {
      return [];
    }

    // Group transactions by category
    const groupedData = new Map<string, number>();
    for (const transaction of transactions) {
      const categoryName = transaction.category?.name ?? 'Uncategorized';
      const value = Math.abs(Number(transaction.value));
      const current = groupedData.get(categoryName) ?? 0;
      groupedData.set(categoryName, current + value);
    }

    // Convert to array and sort by value (descending)
    const dataPoints = Array.from(groupedData.entries())
      .map(([name, value]) => ({name, value}))
      .sort((a, b) => b.value - a.value);

    return dataPoints;
  }, [transactions]);

  /**
   * Prepare budget chart data for stacked column chart
   * Shows budget vs actual spending grouped by month
   */
  const budgetChartData = useMemo(() => {
    if (transactions.length === 0 || budgets.length === 0) {
      return [];
    }

    // Group transactions by month and category
    const transactionsByMonth = new Map<string, Map<string, number>>();

    for (const transaction of transactions) {
      // Only process expense transactions
      if (transaction.category?.type === 'EXPENSE' && transaction.category?.id) {
        const monthKey = dayjs(transaction.date).format('YYYY-MM');
        if (!transactionsByMonth.has(monthKey)) {
          transactionsByMonth.set(monthKey, new Map());
        }
        const categoryMap = transactionsByMonth.get(monthKey)!;
        const categoryId = transaction.category.id;
        const current = categoryMap.get(categoryId) ?? 0;
        categoryMap.set(categoryId, current + Math.abs(Number(transaction.value)));
      }
    }

    // Get all unique months
    const months = Array.from(transactionsByMonth.keys()).sort();

    // Build data points
    const dataPoints: Array<{month: string; [key: string]: string | number}> = [];

    for (const month of months) {
      const dataPoint: {month: string; [key: string]: string | number} = {
        month: dayjs(month).format('MMM YYYY'),
      };

      const categorySpending = transactionsByMonth.get(month)!;

      // For each budget, add budget and actual values
      for (const budget of budgets) {
        if (budget.categoryId) {
          const categoryId = budget.categoryId;
          const budgetAmount = parseFloat(budget.amount);
          const actualAmount = categorySpending.get(categoryId) ?? 0;

          // Use category name as key suffix
          const categoryName = budget.category?.name ?? 'Uncategorized';
          const budgetKey = `${categoryName}_budget`;
          const actualKey = `${categoryName}_actual`;

          dataPoint[budgetKey] = budgetAmount;
          dataPoint[actualKey] = actualAmount;
        }
      }

      dataPoints.push(dataPoint);
    }

    return dataPoints;
  }, [transactions, budgets]);

  /**
   * Check if stacked chart should be visible
   * Only show if: no date filter OR date filter spans multiple months
   */
  const shouldShowStackedChart = useMemo(() => {
    if (!appliedFilters.startDate || !appliedFilters.endDate) {
      return true; // No date filter - show stacked chart
    }
    const groupingType = getDateGroupingType(appliedFilters.startDate, appliedFilters.endDate);
    return groupingType === 'month';
  }, [appliedFilters.startDate, appliedFilters.endDate]);

  /**
   * Prepare Sankey diagram data
   * Flow: Income Categories -> Account -> Expense Categories
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

    // Process income: Income Category -> Account
    // Structure: Map<categoryName, Map<accountName, amount>>
    const incomeByCategoryAccount = new Map<string, Map<string, number>>();

    for (const transaction of incomeTransactions) {
      const categoryName = transaction.category?.name ?? 'Uncategorized';
      const accountName = transaction.account?.name ?? 'Unknown Account';
      const value = Number(transaction.value);

      if (!incomeByCategoryAccount.has(categoryName)) {
        incomeByCategoryAccount.set(categoryName, new Map());
      }
      const accountMap = incomeByCategoryAccount.get(categoryName)!;
      accountMap.set(accountName, (accountMap.get(accountName) ?? 0) + value);
    }

    // Process expenses: Account -> Expense Category
    // Structure: Map<accountName, Map<categoryName, amount>>
    const expenseByAccountCategory = new Map<string, Map<string, number>>();

    for (const transaction of expenseTransactions) {
      const accountName = transaction.account?.name ?? 'Unknown Account';
      const categoryName = transaction.category?.name ?? 'Uncategorized';
      const value = Math.abs(Number(transaction.value));

      if (!expenseByAccountCategory.has(accountName)) {
        expenseByAccountCategory.set(accountName, new Map());
      }
      const categoryMap = expenseByAccountCategory.get(accountName)!;
      categoryMap.set(categoryName, (categoryMap.get(categoryName) ?? 0) + value);
    }

    // Create nodes and links for income flow: Income Category -> Account
    for (const [categoryName, accountMap] of incomeByCategoryAccount.entries()) {
      const incomeCategoryNodeId = `income_category_${categoryName}`;
      const categoryTotal = Array.from(accountMap.values()).reduce((sum, val) => sum + val, 0);
      nodeMap.set(incomeCategoryNodeId, (nodeMap.get(incomeCategoryNodeId) ?? 0) + categoryTotal);

      for (const [accountName, value] of accountMap.entries()) {
        const accountNodeId = `account_${accountName}`;
        nodeMap.set(accountNodeId, (nodeMap.get(accountNodeId) ?? 0) + value);

        // Link: Income Category -> Account
        links.push({
          source: incomeCategoryNodeId,
          target: accountNodeId,
          value,
        });
      }
    }

    // Create nodes and links for expense flow: Account -> Expense Category
    for (const [accountName, categoryMap] of expenseByAccountCategory.entries()) {
      const accountNodeId = `account_${accountName}`;
      // Account node already created from income flow, just ensure it exists
      if (!nodeMap.has(accountNodeId)) {
        nodeMap.set(accountNodeId, 0);
      }

      for (const [categoryName, value] of categoryMap.entries()) {
        const expenseCategoryNodeId = `expense_category_${categoryName}`;
        nodeMap.set(expenseCategoryNodeId, (nodeMap.get(expenseCategoryNodeId) ?? 0) + value);

        // Link: Account -> Expense Category
        links.push({
          source: accountNodeId,
          target: expenseCategoryNodeId,
          value,
        });
      }
    }

    // Convert node map to array with labels
    const nodeLabels: string[] = [];
    const nodeValues: number[] = [];
    const nodeIdToIndex = new Map<string, number>();

    // Add nodes in order: Income Categories -> Accounts -> Expense Categories
    let nodeIndex = 0;

    // Column 0: Income Categories
    for (const categoryName of Array.from(incomeByCategoryAccount.keys()).sort()) {
      const nodeId = `income_category_${categoryName}`;
      nodeIdToIndex.set(nodeId, nodeIndex);
      nodeLabels.push(categoryName);
      nodeValues.push(nodeMap.get(nodeId) ?? 0);
      nodeIndex++;
    }

    // Column 1: Accounts (union of accounts from income and expense)
    const accountSet = new Set<string>();
    for (const accountMap of incomeByCategoryAccount.values()) {
      for (const accountName of accountMap.keys()) {
        accountSet.add(accountName);
      }
    }
    for (const accountName of expenseByAccountCategory.keys()) {
      accountSet.add(accountName);
    }
    for (const accountName of Array.from(accountSet).sort()) {
      const nodeId = `account_${accountName}`;
      nodeIdToIndex.set(nodeId, nodeIndex);
      nodeLabels.push(accountName);
      nodeValues.push(nodeMap.get(nodeId) ?? 0);
      nodeIndex++;
    }

    // Column 2: Expense Categories
    const expenseCategorySet = new Set<string>();
    for (const categoryMap of expenseByAccountCategory.values()) {
      for (const categoryName of categoryMap.keys()) {
        expenseCategorySet.add(categoryName);
      }
    }
    for (const categoryName of Array.from(expenseCategorySet).sort()) {
      const nodeId = `expense_category_${categoryName}`;
      nodeIdToIndex.set(nodeId, nodeIndex);
      nodeLabels.push(categoryName);
      nodeValues.push(nodeMap.get(nodeId) ?? 0);
      nodeIndex++;
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
  }, [transactions]);

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
      formatDateShort(t.date, dateFormat),
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
  }, [transactions, appliedFilters, accounts, categories, payees, totalCount, totalAmount, currency, dateFormat]);

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

      {/* Actions Card with Transaction Count */}
      {hasFilters && transactions.length > 0 && (
        <Card sx={{p: 3, mb: 3}}>
          <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
              <Receipt color="primary" />
              <Typography variant="body1" color="text.secondary">
                {summaryStats.transactionCount.toLocaleString()} Transactions
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleDownloadPDF} startIcon={<PictureAsPdf />} sx={{textTransform: 'none'}}>
              Download PDF
            </Button>
          </Box>
        </Card>
      )}

      {/* Summary Cards */}
      {hasFilters && totalCount > 0 && (
        <Grid container spacing={2} sx={{mb: 3}}>
          <Grid item xs={4}>
            <Card sx={{p: 3, height: '100%'}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                <AttachMoney color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Total
                </Typography>
              </Box>
              <Typography variant="h5" sx={{fontWeight: 600}}>
                {formatCurrencyAbbreviated(summaryStats.totalAmount, currency)}
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card sx={{p: 3, height: '100%'}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                <TrendingUp sx={{color: 'success.main'}} />
                <Typography variant="subtitle2" color="text.secondary">
                  Income
                </Typography>
              </Box>
              <Typography variant="h5" sx={{fontWeight: 600, color: 'success.main'}}>
                {formatCurrencyAbbreviated(summaryStats.income, currency)}
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card sx={{p: 3, height: '100%'}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                <TrendingDown sx={{color: 'error.main'}} />
                <Typography variant="subtitle2" color="text.secondary">
                  Expenses
                </Typography>
              </Box>
              <Typography variant="h5" sx={{fontWeight: 600, color: 'error.main'}}>
                {formatCurrencyAbbreviated(summaryStats.expense, currency)}
              </Typography>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Chart Section */}
      {hasFilters && !loading && transactions.length > 0 && ((chartType !== 'sankey' && chartType !== 'pie' && chartType !== 'stacked' && chartData.length > 0) || (chartType === 'pie' && pieChartData.length > 0) || (chartType === 'sankey' && sankeyData !== null) || (chartType === 'stacked' && shouldShowStackedChart)) && (
        <Card sx={{p: 3, mb: 3}}>
          <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
            <Typography variant="h6" component="h2">
              Trends
            </Typography>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => {
                if (value !== null && (value === 'line' || value === 'bar' || value === 'pie' || value === 'sankey' || value === 'stacked')) {
                  setChartType(value as 'line' | 'bar' | 'pie' | 'sankey' | 'stacked');
                }
              }}
              size="small"
            >
              <ToggleButton value="line" aria-label="Line chart">
                <ShowChart />
              </ToggleButton>
              <ToggleButton value="pie" aria-label="Pie chart">
                <DonutLarge />
              </ToggleButton>
              <ToggleButton value="bar" aria-label="Bar chart">
                <BarChartIcon />
              </ToggleButton>
              {shouldShowStackedChart && (
                <ToggleButton value="stacked" aria-label="Stacked column chart">
                  <Layers />
                </ToggleButton>
              )}
              <ToggleButton value="sankey" aria-label="Cash flow chart">
                <Timeline />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box sx={{width: '100%', height: 400}}>
            {chartType === 'sankey' ? (
              sankeyData && (
                <SankeyChart data={sankeyData} height={400} currency={currency} />
              )
            ) : chartType === 'pie' ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, percent}: {name: string; percent: number}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((item, index) => {
                      const baseColor = getSeriesColor(index);
                      // Reduce opacity if item is in hiddenSeries (toggled state)
                      const opacity = hiddenSeries.has(item.name) ? 0.3 : 1;
                      return <Cell key={`cell-${item.name}`} fill={baseColor} opacity={opacity} />;
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown): string => formatCurrencyAbbreviated(Number(value), currency)}
                  />
                  <Legend
                    onClick={(data: unknown, _index: number, _event: React.MouseEvent) => {
                      const payload = data as {value?: unknown; dataKey?: string | number};
                      if (payload.value && typeof payload.value === 'string') {
                        handleLegendClick(payload.value);
                      }
                    }}
                    formatter={(value: string): string => {
                      const dataPoint = pieChartData.find((d) => d.name === value);
                      if (dataPoint) {
                        return `${value}: ${formatCurrencyAbbreviated(dataPoint.value, currency)}`;
                      }
                      return value;
                    }}
                    align="left"
                    iconSize={12}
                    wrapperStyle={{cursor: 'pointer', fontSize: '11px', opacity: 0.5}}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : chartType === 'stacked' ? (
              budgetChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
                    <XAxis
                      dataKey="month"
                      stroke={theme.palette.text.secondary}
                      tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
                    />
                    <YAxis
                      tickFormatter={formatYAxisTick}
                      stroke={theme.palette.text.secondary}
                      tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      onClick={(data: unknown, _index: number, _event: React.MouseEvent) => {
                        const payload = data as {value?: unknown; dataKey?: string | number | ((obj: unknown) => unknown)};
                        if (payload.dataKey && typeof payload.dataKey === 'string') {
                          handleLegendClick(payload.dataKey);
                        }
                      }}
                      align="left"
                      iconSize={12}
                      wrapperStyle={{cursor: 'pointer', fontSize: '11px', opacity: 0.5}}
                    />
                    {budgets
                      .filter((budget) => budget.categoryId)
                      .map((budget, index) => {
                        const categoryName = budget.category?.name ?? 'Uncategorized';
                        const budgetKey = `${categoryName}_budget`;
                        const actualKey = `${categoryName}_actual`;
                        const budgetOpacity = hiddenSeries.has(budgetKey) ? 0.3 : 1;
                        const actualOpacity = hiddenSeries.has(actualKey) ? 0.3 : 1;
                        return (
                          <React.Fragment key={budget.id}>
                            <Bar
                              dataKey={budgetKey}
                              stackId="budget"
                              fill={getSeriesColor(index * 2)}
                              name={`${categoryName} (Budget)`}
                              radius={[0, 0, 0, 0]}
                              opacity={budgetOpacity}
                            />
                            <Bar
                              dataKey={actualKey}
                              stackId="actual"
                              fill={getSeriesColor(index * 2 + 1)}
                              name={`${categoryName} (Actual)`}
                              radius={[4, 4, 0, 0]}
                              opacity={actualOpacity}
                            />
                          </React.Fragment>
                        );
                      })}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2}}>
                  <Typography variant="body2" color="text.secondary">
                    No budget data available for the selected period
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{opacity: 0.7}}>
                    Create budgets and add expense transactions to see budget vs actual comparison
                  </Typography>
                </Box>
              )
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      stroke={theme.palette.text.secondary}
                      tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
                    />
                    <YAxis
                      tickFormatter={formatYAxisTick}
                      stroke={theme.palette.text.secondary}
                      tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      onClick={(data: unknown, _index: number, _event: React.MouseEvent) => {
                        const payload = data as {value?: unknown; dataKey?: string | number | ((obj: unknown) => unknown)};
                        if (payload.dataKey && typeof payload.dataKey === 'string') {
                          handleLegendClick(payload.dataKey);
                        }
                      }}
                      align="left"
                      iconSize={12}
                      wrapperStyle={{cursor: 'pointer', fontSize: '11px', opacity: 0.5}}
                    />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke={theme.palette.success.main}
                      name="Income"
                      strokeWidth={2}
                      dot={{fill: theme.palette.success.main, r: 3, opacity: hiddenSeries.has('income') ? 0.3 : 1}}
                      activeDot={{r: 5, fill: theme.palette.success.main}}
                      connectNulls
                      strokeOpacity={hiddenSeries.has('income') ? 0.3 : 1}
                    />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      stroke={theme.palette.error.main}
                      name="Expense"
                      strokeWidth={2}
                      dot={{fill: theme.palette.error.main, r: 3, opacity: hiddenSeries.has('expense') ? 0.3 : 1}}
                      activeDot={{r: 5, fill: theme.palette.error.main}}
                      connectNulls
                      strokeOpacity={hiddenSeries.has('expense') ? 0.3 : 1}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      stroke={theme.palette.text.secondary}
                      tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
                    />
                    <YAxis
                      tickFormatter={formatYAxisTick}
                      stroke={theme.palette.text.secondary}
                      tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      onClick={(data: unknown, _index: number, _event: React.MouseEvent) => {
                        const payload = data as {value?: unknown; dataKey?: string | number | ((obj: unknown) => unknown)};
                        if (payload.dataKey && typeof payload.dataKey === 'string') {
                          handleLegendClick(payload.dataKey);
                        }
                      }}
                      align="left"
                      iconSize={12}
                      wrapperStyle={{cursor: 'pointer', fontSize: '11px', opacity: 0.5}}
                    />
                    {chartSeriesKeys.map((seriesKey, index) => {
                      const opacity = hiddenSeries.has(seriesKey) ? 0.3 : 1;
                      return (
                        <Bar
                          key={seriesKey}
                          dataKey={seriesKey}
                          fill={getSeriesColor(index)}
                          name={seriesKey}
                          radius={[4, 4, 0, 0]}
                          opacity={opacity}
                        />
                      );
                    })}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </Box>
          {/* Chart Descriptions */}
          <Box sx={{mt: 2}}>
            <Typography variant="body2" color="text.secondary" sx={{fontSize: '0.875rem'}}>
              {chartType === 'line' && 'Visualizes income and expense trends over time to identify patterns and seasonal variations'}
              {chartType === 'pie' && 'Shows the proportion of expenses across different categories to identify spending patterns'}
              {chartType === 'stacked' && 'Compares budgeted amounts with actual spending to track financial discipline'}
              {chartType === 'sankey' && 'Illustrates cash flow from income sources through categories to expenses, showing how money moves through your financial system'}
              {chartType === 'bar' && 'Displays transaction data in bar format for easy comparison'}
            </Typography>
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
