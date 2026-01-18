/**
 * Report Page
 * Comprehensive reporting interface with filters, charts, and interactive results
 */

import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {Box, Typography, CircularProgress} from '@mui/material';
import {useQuery, useMutation} from '@apollo/client/react';
import {useNavigate} from 'react-router';
import {Receipt, Clear} from '@mui/icons-material';
import {EmptyState} from '../components/common/EmptyState';
import {formatCurrencyPreserveDecimals, formatDateShort} from '../utils/formatting';
import {validateDateRange} from '../utils/validation';
import {GET_PREFERENCES, GET_CATEGORIES, GET_PAYEES, GET_REPORT_TRANSACTIONS, GET_RECENT_TRANSACTIONS, GET_BUDGETS} from '../graphql/queries';
import {GET_WORKSPACES, GET_WORKSPACE_MEMBERS} from '../graphql/workspaceOperations';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {useAccounts} from '../hooks/useAccounts';
import {useDateFormat} from '../hooks/useDateFormat';
import {useReportFilters} from '../hooks/useReportFilters';
import {useReportChartData, type ReportTransaction} from '../hooks/useReportChartData';
import type {TransactionOrderInput, TransactionOrderByField} from '../hooks/useTransactions';
import {ITEMS_PER_PAGE} from '../constants';
import {TransactionList} from '../components/TransactionList';
import {PageContainer} from '../components/common/PageContainer';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import type {MultiSelectOption} from '../components/ui/MultiSelect';
import {ReportSummary, type SummaryStats} from '../components/report/ReportSummary';
import {ReportFilters} from '../components/report/ReportFilters';
import {ReportCharts} from '../components/report/ReportCharts';

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
 * Report Page Component
 */
export function ReportPage(): React.JSX.Element {
  const navigate = useNavigate();
  const {data: preferencesData} = useQuery<{preferences?: {currency: string}}>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';

  const {accounts} = useAccounts();
  const {dateFormat} = useDateFormat();
  const {data: categoriesData} = useQuery<{categories?: Array<{id: string; name: string}>}>(GET_CATEGORIES);
  const {data: payeesData} = useQuery<{payees?: Array<{id: string; name: string}>}>(GET_PAYEES);
  const {data: budgetsData} = useQuery<{budgets?: Array<{id: string; amount: string; currentSpent: string; categoryId: string | null; category: {id: string; name: string} | null}>}>(GET_BUDGETS);

  // Get workspaces and members
  const {data: workspacesData} = useQuery<{
    workspaces: Array<{
      id: string;
      name: string;
    }>;
  }>(GET_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
  });

  const workspaces = useMemo(() => workspacesData?.workspaces ?? [], [workspacesData?.workspaces]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

  // Auto-select first workspace if available
  React.useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      const firstWorkspace = workspaces[0];
      if (firstWorkspace) {
        setSelectedWorkspaceId(firstWorkspace.id);
      }
    }
  }, [workspaces, selectedWorkspaceId]);

  const {data: membersData} = useQuery<{
    workspaceMembers: Array<{
      id: string;
      userId: string;
      user: {
        id: string;
        email: string;
      };
    }>;
  }>(GET_WORKSPACE_MEMBERS, {
    variables: {workspaceId: selectedWorkspaceId},
    skip: !selectedWorkspaceId,
    fetchPolicy: 'cache-and-network',
  });

  const members = useMemo(() => membersData?.workspaceMembers ?? [], [membersData?.workspaceMembers]);

  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData?.categories]);
  const payees = useMemo(() => payeesData?.payees ?? [], [payeesData?.payees]);
  const budgets = useMemo(() => budgetsData?.budgets ?? [], [budgetsData?.budgets]);

  // Use report filters hook
  const filterHook = useReportFilters(dateFormat, accounts, categories, payees, members);

  // Sorting state
  const [sortField, setSortField] = useState<TransactionOrderByField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Chart type state
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie' | 'sankey' | 'stacked' | 'area' | 'categoryBreakdown'>('line');

  // Pagination state
  const [page, setPage] = useState(1);

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
      memberIds?: string[];
      orderBy: TransactionOrderInput;
      skip?: number;
      take?: number;
    } = {
      orderBy,
      skip,
      take: ITEMS_PER_PAGE,
    };

    const {appliedFilters} = filterHook;
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
    if (appliedFilters.memberIds.length > 0) {
      vars.memberIds = appliedFilters.memberIds;
    }

    return vars;
  }, [filterHook, sortField, sortDirection, page]);

  // Fetch report data
  const {data, loading, error, refetch} = useQuery<ReportData>(GET_REPORT_TRANSACTIONS, {
    variables: queryVariables,
    skip: !filterHook.hasFilters, // Only fetch when filters are applied
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
    if (filterHook.hasFilters && !loading && transactions.length > 0) {
      filterHook.setFilterPanelExpanded(false);
    }
  }, [filterHook.hasFilters, loading, transactions.length, filterHook]);

  // Reset page when applied filters change
  useEffect(() => {
    setPage(1);
  }, [filterHook.appliedFilters]);

  // Delete mutation
  const [deleteTransaction] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: [{query: GET_REPORT_TRANSACTIONS}, {query: GET_RECENT_TRANSACTIONS}],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void refetch();
    },
  });

  /**
   * Handle workspace change
   */
  const handleWorkspaceChange = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    // Clear member filter when workspace changes
    filterHook.handleFilterChange('memberIds', []);
    filterHook.setAppliedFilters((prev) => ({...prev, memberIds: []}));
  }, [filterHook]);

  // Use report chart data hook
  const chartDataHook = useReportChartData(
    transactions,
    budgets,
    filterHook.appliedFilters.startDate,
    filterHook.appliedFilters.endDate,
    dateFormat,
    currency,
  );

  /**
   * Calculate summary statistics
   * Uses backend-calculated totalIncome and totalExpense for accuracy across all filtered transactions
   */
  const summaryStats = useMemo<SummaryStats>(() => {
    if (totalCount === 0) {
      return {
        totalAmount: 0,
        transactionCount: 0,
        income: 0,
        expense: 0,
      };
    }

    return {
      totalAmount,
      transactionCount: totalCount,
      income: totalIncome,
      expense: totalExpense,
    };
  }, [totalCount, totalAmount, totalIncome, totalExpense]);

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
   * Generate and download PDF
   */
  const handleDownloadPDF = useCallback(async () => {
    // Dynamically import jspdf and autotable
    const [jsPDFModule, autoTable] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const jsPDF = jsPDFModule.default || (jsPDFModule as {jsPDF: typeof jsPDFModule.default}).jsPDF || jsPDFModule;
    const doc = new jsPDF();
    const margin = 20;
    let yPosition = margin;

    // Title
    doc.setFontSize(18);
    doc.text('Transaction Report', margin, yPosition);
    yPosition += 10;

    // Date range
    doc.setFontSize(12);
    const {appliedFilters: appliedFiltersForPDF} = filterHook;
    if (appliedFiltersForPDF.startDate || appliedFiltersForPDF.endDate) {
      const dateRange = `${appliedFiltersForPDF.startDate || 'Start'} to ${appliedFiltersForPDF.endDate || 'End'}`;
      doc.text(`Date Range: ${dateRange}`, margin, yPosition);
      yPosition += 8;
    }

    // Filters summary
    const filterSummary: string[] = [];
    if (appliedFiltersForPDF.accountIds.length > 0) {
      const accountNames = appliedFiltersForPDF.accountIds
        .map((id) => accounts.find((a) => a.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      filterSummary.push(`Accounts: ${accountNames}`);
    }
    if (appliedFiltersForPDF.categoryIds.length > 0) {
      const categoryNames = appliedFiltersForPDF.categoryIds
        .map((id) => categories.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      filterSummary.push(`Categories: ${categoryNames}`);
    }
    if (appliedFiltersForPDF.payeeIds.length > 0) {
      const payeeNames = appliedFiltersForPDF.payeeIds
        .map((id) => payees.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      filterSummary.push(`Payees: ${payeeNames}`);
    }
    if (appliedFiltersForPDF.note.trim()) {
      filterSummary.push(`Note: ${appliedFiltersForPDF.note.trim()}`);
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
    autoTable.default(doc, {
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
  }, [transactions, filterHook, accounts, categories, payees, totalCount, totalAmount, currency, dateFormat]);

  // Validation error
  const validationError = useMemo(() => {
    const {filters} = filterHook;
    if (filters.startDate && filters.endDate) {
      if (!validateDateRange(filters.startDate, filters.endDate)) {
        return 'End date must be after start date';
      }
    }
    return null;
  }, [filterHook]);

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
    <PageContainer>
      {/* Filters Section */}
      <ReportFilters
        filters={filterHook.filters}
        datePreset={filterHook.datePreset}
        showDatePickers={filterHook.showDatePickers}
        filterPanelExpanded={filterHook.filterPanelExpanded}
        datePickerAnchor={filterHook.datePickerAnchor}
        datePickerType={filterHook.datePickerType}
        startDateText={filterHook.startDateText}
        endDateText={filterHook.endDateText}
        activeFilters={filterHook.activeFilters}
        hasFilters={filterHook.hasFilters}
        handleFilterChange={filterHook.handleFilterChange}
        handlePresetDateRange={filterHook.handlePresetDateRange}
        handleStartDateChange={filterHook.handleStartDateChange}
        handleEndDateChange={filterHook.handleEndDateChange}
        handleDatePickerOpen={filterHook.handleDatePickerOpen}
        handleDatePickerClose={filterHook.handleDatePickerClose}
        handleApplyFilters={filterHook.handleApplyFilters}
        handleClearFilters={filterHook.handleClearFilters}
        setFilterPanelExpanded={filterHook.setFilterPanelExpanded}
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        payeeOptions={payeeOptions}
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        members={members}
        onWorkspaceChange={handleWorkspaceChange}
        validationError={validationError}
        error={error ? (error instanceof Error ? error : new Error(error.message || 'Unknown error')) : null}
      />

      {/* Summary Section */}
      <ReportSummary
        summaryStats={summaryStats}
        totalCount={totalCount}
        currency={currency}
        hasFilters={filterHook.hasFilters}
        formatCurrencyAbbreviated={chartDataHook.formatCurrencyAbbreviated}
        onDownloadPDF={handleDownloadPDF}
      />

      {/* Chart Section */}
      <ReportCharts
        chartType={chartType}
        onChartTypeChange={setChartType}
        chartData={chartDataHook.chartData}
        pieChartData={chartDataHook.pieChartData}
        budgetChartData={chartDataHook.budgetChartData}
        sankeyData={chartDataHook.sankeyData}
        chartSeriesKeys={chartDataHook.chartSeriesKeys}
        hiddenSeries={chartDataHook.hiddenSeries}
        shouldShowStackedChart={chartDataHook.shouldShowStackedChart}
        getSeriesColor={chartDataHook.getSeriesColor}
        handleLegendClick={chartDataHook.handleLegendClick}
        formatCurrencyAbbreviated={chartDataHook.formatCurrencyAbbreviated}
        formatYAxisTick={chartDataHook.formatYAxisTick}
        budgets={budgets}
        currency={currency}
        hasFilters={filterHook.hasFilters}
        loading={loading}
        transactionsLength={transactions.length}
      />

      {/* Results Section */}
      {!filterHook.hasFilters ? (
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
            <Button variant="outlined" onClick={filterHook.handleClearFilters} startIcon={<Clear />} sx={{textTransform: 'none'}}>
              Clear Filters
            </Button>
          }
        />
      ) : (
        <TransactionList
          transactions={paginatedTransactions}
          loading={loading}
          error={error ? (error instanceof Error ? error : new Error(error.message || 'Unknown error')) : undefined}
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
    </PageContainer>
  );
}
