/**
 * Report Page
 * Comprehensive reporting interface with filters, charts, and interactive results
 */

import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Menu,
  MenuItem,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Popover,
  Collapse,
  Pagination,
} from '@mui/material';
import {MoreVert, Edit, Delete, ArrowUpward, ArrowDownward, Clear, PictureAsPdf, CalendarToday, ExpandMore, ExpandLess, ShowChart, BarChart as BarChartIcon} from '@mui/icons-material';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, {type Dayjs} from 'dayjs';
import {useQuery, useMutation} from '@apollo/client/react';
import {useNavigate} from 'react-router';
import {LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from 'recharts';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {TextField} from '../components/ui/TextField';
import {MultiSelect, type MultiSelectOption} from '../components/ui/MultiSelect';
import {formatCurrencyPreserveDecimals, formatDateShort} from '../utils/formatting';
import {validateDateRange} from '../utils/validation';
import {GET_PREFERENCES, GET_CATEGORIES, GET_PAYEES, GET_REPORT_TRANSACTIONS} from '../graphql/queries';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {useAccounts} from '../hooks/useAccounts';
import type {TransactionOrderInput} from '../hooks/useTransactions';
import {ITEMS_PER_PAGE} from '../utils/constants';

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
 * Report Page Component
 */
export function ReportPage(): React.JSX.Element {
  const navigate = useNavigate();
  const {data: preferencesData} = useQuery<{preferences?: {currency: string}}>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';

  const {accounts} = useAccounts();
  const {data: categoriesData} = useQuery<{categories?: Array<{id: string; name: string}>}>(GET_CATEGORIES);
  const {data: payeesData} = useQuery<{payees?: Array<{id: string; name: string}>}>(GET_PAYEES);

  const categories = categoriesData?.categories ?? [];
  const payees = payeesData?.payees ?? [];

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
  const [sortField, setSortField] = useState<'date' | 'value' | 'account' | 'payee' | 'category'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Chart type state
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Pagination state
  const [page, setPage] = useState(1);

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<{element: HTMLElement; transactionId: string} | null>(null);

  // Delete state
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);

  // Date picker popover state
  const [datePickerAnchor, setDatePickerAnchor] = useState<HTMLElement | null>(null);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end' | null>(null);

  // Filter panel collapse state
  const [filterPanelExpanded, setFilterPanelExpanded] = useState<boolean>(true);

  // Build orderBy object
  const orderBy: TransactionOrderInput = {
    field: sortField,
    direction: sortDirection,
  };

  // Build query variables
  const queryVariables = useMemo(() => {
    const skip = (page - 1) * ITEMS_PER_PAGE;
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
  }, [appliedFilters, orderBy, page]);

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

  const transactions = data?.reportTransactions?.items ?? [];
  const totalCount = data?.reportTransactions?.totalCount ?? 0;
  const totalAmount = data?.reportTransactions?.totalAmount ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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
  const [deleteTransaction, {loading: deleting}] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: ['GetReportTransactions', 'GetRecentTransactions'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      setDeletingTransactionId(null);
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
    setFilterPanelExpanded(true);
  }, []);

  /**
   * Handle sort column click
   */
  const handleSort = useCallback(
    (field: 'date' | 'value' | 'account' | 'payee' | 'category') => {
      if (sortField === field) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
      setPage(1); // Reset to first page when sorting changes
    },
    [sortField, sortDirection],
  );

  /**
   * Handle menu open
   */
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, transactionId: string) => {
    event.stopPropagation();
    setMenuAnchor({element: event.currentTarget, transactionId});
  }, []);

  /**
   * Handle menu close
   */
  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  /**
   * Handle edit click - navigate to edit page
   */
  const handleEdit = useCallback(() => {
    if (menuAnchor) {
      const transactionId = menuAnchor.transactionId;
      void navigate(`/transactions/${transactionId}/edit?returnTo=${encodeURIComponent('/report')}`);
      handleMenuClose();
    }
  }, [menuAnchor, navigate, handleMenuClose]);

  /**
   * Handle delete click
   */
  const handleDeleteClick = useCallback(() => {
    if (menuAnchor) {
      setDeletingTransactionId(menuAnchor.transactionId);
      handleMenuClose();
    }
  }, [menuAnchor, handleMenuClose]);

  /**
   * Handle delete confirmation
   */
  const handleDeleteConfirm = useCallback(() => {
    if (deletingTransactionId) {
      void deleteTransaction({
        variables: {id: deletingTransactionId},
      });
    }
  }, [deletingTransactionId, deleteTransaction]);

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
   * Get sort icon for column
   */
  const getSortIcon = (field: 'date' | 'value' | 'account' | 'payee' | 'category') => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

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

  return (
    <Box sx={{p: 2, width: '100%'}}>
      {/* Filters Section */}
      <Card sx={{p: 2, mb: 3}}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setFilterPanelExpanded(!filterPanelExpanded)}
        >
          <Typography variant="h6">Filters</Typography>
          <IconButton size="small" onClick={(e) => {
            e.stopPropagation();
            setFilterPanelExpanded(!filterPanelExpanded);
          }}>
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
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
              {/* Date Range - Two Separate Buttons */}
              <Box sx={{display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap'}}>
                <Button
                  variant="outlined"
                  onClick={(e) => handleDatePickerOpen(e, 'start')}
                  startIcon={<CalendarToday />}
                  sx={{flex: 1, justifyContent: 'flex-start', textTransform: 'none'}}
                >
                  {startDateText}
                </Button>
                <Button
                  variant="outlined"
                  onClick={(e) => handleDatePickerOpen(e, 'end')}
                  startIcon={<CalendarToday />}
                  sx={{flex: 1, justifyContent: 'flex-start', textTransform: 'none'}}
                >
                  {endDateText}
                </Button>
              </Box>

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
                Apply
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Card>

      {/* Actions Card */}
      {(hasFilters || transactions.length > 0) && (
        <Card sx={{p: 2, mb: 3}}>
          <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap'}}>
            {transactions.length > 0 && (
              <Button variant="contained" onClick={handleDownloadPDF} startIcon={<PictureAsPdf />} sx={{textTransform: 'none'}}>
                Download PDF
              </Button>
            )}
            {hasFilters && (
              <Button variant="outlined" onClick={handleClearFilters} startIcon={<Clear />} sx={{textTransform: 'none'}}>
                Clear
              </Button>
            )}
          </Box>
        </Card>
      )}

      {/* Chart Section */}
      {transactions.length > 0 && chartData.length > 0 && (
        <Card sx={{p: 2, mb: 3}}>
          <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
            <Typography variant="h6">Chart</Typography>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => {
                if (value !== null && (value === 'line' || value === 'bar')) {
                  setChartType(value as 'line' | 'bar');
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
            </ToggleButtonGroup>
          </Box>
          <Box sx={{width: '100%', height: 300}}>
            <ResponsiveContainer>
              {chartType === 'line' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="#8884d8" name="Amount" />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="amount" fill="#8884d8" name="Amount" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </Box>
        </Card>
      )}

      {/* Results Section */}
      <Card sx={{p: 2}}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
          <Typography variant="h6">
            Results {totalCount > 0 && `(${totalCount})`}
          </Typography>
          {totalCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              Total: {formatCurrencyPreserveDecimals(totalAmount, currency)}
            </Typography>
          )}
        </Box>

        {loading ? (
          <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
            <CircularProgress />
          </Box>
        ) : !hasFilters ? (
          <Box sx={{py: 4, textAlign: 'center'}}>
            <Typography variant="body2" color="text.secondary">
              Apply filters to generate report
            </Typography>
          </Box>
        ) : transactions.length === 0 ? (
          <Box sx={{py: 4, textAlign: 'center'}}>
            <Typography variant="body2" color="text.secondary">
              No transactions found matching your filters
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'date'}
                        direction={sortField === 'date' ? sortDirection : 'asc'}
                        onClick={() => handleSort('date')}
                        IconComponent={() => getSortIcon('date')}
                      >
                        Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'value'}
                        direction={sortField === 'value' ? sortDirection : 'asc'}
                        onClick={() => handleSort('value')}
                        IconComponent={() => getSortIcon('value')}
                      >
                        Value
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'account'}
                        direction={sortField === 'account' ? sortDirection : 'asc'}
                        onClick={() => handleSort('account')}
                        IconComponent={() => getSortIcon('account')}
                      >
                        Account
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'payee'}
                        direction={sortField === 'payee' ? sortDirection : 'asc'}
                        onClick={() => handleSort('payee')}
                        IconComponent={() => getSortIcon('payee')}
                      >
                        Payee
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'category'}
                        direction={sortField === 'category' ? sortDirection : 'asc'}
                        onClick={() => handleSort('category')}
                        IconComponent={() => getSortIcon('category')}
                      >
                        Category
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Note</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      hover
                      sx={{cursor: 'pointer'}}
                      onClick={() => handleRowClick(transaction.id)}
                    >
                      <TableCell>{formatDateShort(transaction.date)}</TableCell>
                      <TableCell>{formatCurrencyPreserveDecimals(transaction.value, currency)}</TableCell>
                      <TableCell>{transaction.account?.name ?? '-'}</TableCell>
                      <TableCell>{transaction.payee?.name ?? '-'}</TableCell>
                      <TableCell>{transaction.category?.name ?? '-'}</TableCell>
                      <TableCell>{transaction.note ?? '-'}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, transaction.id)}
                          aria-label="More actions"
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {totalPages > 1 && (
              <Box sx={{display: 'flex', justifyContent: 'center', mt: 2, pb: 2}}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                />
              </Box>
            )}
          </>
        )}
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor?.element ?? null}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Edit fontSize="small" sx={{mr: 1}} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <Delete fontSize="small" sx={{mr: 1}} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingTransactionId)}
        onClose={() => setDeletingTransactionId(null)}
      >
        <DialogTitle>Delete Transaction</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this transaction? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingTransactionId(null)} disabled={deleting} sx={{textTransform: 'none'}}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting} sx={{textTransform: 'none'}}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

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
