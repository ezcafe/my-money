/**
 * Report Chart Data Hook
 * Manages chart data preparation, series visibility, and chart utilities for report page
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  formatDateShort,
  formatMonthYear,
  formatCurrencyPreserveDecimals,
} from '../utils/formatting';
import type { DateFormat } from '../contexts/DateFormatContext';

/**
 * Transaction type from report query
 */
export interface ReportTransaction {
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
    categoryType?: string;
  } | null;
  payee: {
    id: string;
    name: string;
  } | null;
  note?: string | null;
}

/**
 * Chart data point with dynamic series keys
 */
export interface ChartDataPoint {
  date: string;
  originalDate?: string;
  [key: string]: string | number | undefined; // Dynamic keys for payee-category combinations
}

/**
 * Pie chart data point
 */
export interface PieChartDataPoint {
  name: string;
  value: number;
}

/**
 * Budget chart data point
 */
export interface BudgetChartDataPoint {
  month: string;
  [key: string]: string | number; // Dynamic keys for budget/actual pairs
}

/**
 * Budget type
 */
export interface Budget {
  id: string;
  amount: string;
  currentSpent: string;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
  } | null;
}

/**
 * Sankey chart data
 */
export interface SankeyData {
  node: {
    label: string[];
    pad: number;
    thickness: number;
    line: {
      color: string;
      width: number;
    };
  };
  link: {
    source: number[];
    target: number[];
    value: number[];
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
function getGroupKey(
  date: string,
  groupingType: 'month' | 'week' | 'date',
  dateFormat: DateFormat
): string {
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
 * Report chart data hook return type
 */
export interface UseReportChartDataReturn {
  chartData: ChartDataPoint[];
  pieChartData: PieChartDataPoint[];
  budgetChartData: BudgetChartDataPoint[];
  sankeyData: SankeyData | null;
  chartSeriesKeys: string[];
  hiddenSeries: Set<string>;
  shouldShowStackedChart: boolean;
  getSeriesColor: (index: number) => string;
  handleLegendClick: (dataKey: string) => void;
  formatCurrencyAbbreviated: (value: number, currencyCode: string) => string;
  formatYAxisTick: (value: unknown) => string;
}

/**
 * Hook for managing report chart data and utilities
 * @param transactions - Array of report transactions
 * @param budgets - Array of budgets
 * @param startDate - Start date filter
 * @param endDate - End date filter
 * @param dateFormat - Date format for display
 * @param currency - Currency code
 * @returns Chart data and utilities
 */
export function useReportChartData(
  transactions: ReportTransaction[],
  budgets: Budget[],
  startDate: string,
  endDate: string,
  dateFormat: DateFormat,
  _currency: string
): UseReportChartDataReturn {
  // Chart series visibility state (track which series are hidden)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  /**
   * Prepare chart data for line chart showing income and expense lines
   * Groups by month/week/date based on date filter range
   */
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (transactions.length === 0) {
      return [];
    }

    // Determine date grouping type
    const groupingType = getDateGroupingType(startDate, endDate);

    // Separate income and expense transactions
    const incomeTransactions = transactions.filter((t) => t.category?.categoryType === 'Income');
    const expenseTransactions = transactions.filter(
      (t) => !t.category || t.category.categoryType === 'Expense'
    );

    // Group by date period
    // Structure: Map<groupKey, {income: number, expense: number}>
    const groupedData = new Map<
      string,
      { income: number; expense: number; originalDate: string }
    >();

    // Process income transactions
    for (const transaction of incomeTransactions) {
      const groupKey = getGroupKey(transaction.date, groupingType, dateFormat);
      const existing = groupedData.get(groupKey) ?? {
        income: 0,
        expense: 0,
        originalDate: transaction.date,
      };
      existing.income += Number(transaction.value);
      groupedData.set(groupKey, existing);
    }

    // Process expense transactions
    for (const transaction of expenseTransactions) {
      const groupKey = getGroupKey(transaction.date, groupingType, dateFormat);
      const existing = groupedData.get(groupKey) ?? {
        income: 0,
        expense: 0,
        originalDate: transaction.date,
      };
      existing.expense += Math.abs(Number(transaction.value));
      groupedData.set(groupKey, existing);
    }

    // Convert to array and format dates
    const dataPoints: ChartDataPoint[] = Array.from(groupedData.entries())
      .map(([, data]) => {
        // Format the group key for display
        let formattedDate: string;
        if (groupingType === 'month') {
          formattedDate = formatMonthYear(data.originalDate, dateFormat);
        } else if (groupingType === 'week') {
          const dateObj = dayjs(data.originalDate);
          const weekStart = dateObj.startOf('week').toDate();
          const weekEnd = dateObj.endOf('week').toDate();
          formattedDate = `${formatDateShort(weekStart, dateFormat)} - ${formatDateShort(weekEnd, dateFormat)}`;
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
      .sort(
        (a, b) =>
          new Date(a.originalDate ?? '').getTime() - new Date(b.originalDate ?? '').getTime()
      );

    return dataPoints;
  }, [transactions, startDate, endDate, dateFormat]);

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
   * Format Y-axis tick values with abbreviation
   */
  const formatYAxisTick = useCallback((value: unknown): string => {
    const numValue = typeof value === 'number' ? value : Number(value);
    if (typeof numValue !== 'number' || Number.isNaN(numValue) || !Number.isFinite(numValue)) {
      return '';
    }
    // Use formatNumberAbbreviation if available, otherwise format directly
    if (numValue >= 1_000_000_000) {
      return `${(numValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    }
    if (numValue >= 1_000_000) {
      return `${(numValue / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (numValue >= 1_000) {
      return `${(numValue / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    }
    return numValue.toString();
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
      .map(([name, value]) => ({ name, value }))
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
      if (transaction.category?.categoryType === 'Expense' && transaction.category?.id) {
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
    const dataPoints: BudgetChartDataPoint[] = [];

    for (const month of months) {
      const dataPoint: BudgetChartDataPoint = {
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
    if (!startDate || !endDate) {
      return true; // No date filter - show stacked chart
    }
    const groupingType = getDateGroupingType(startDate, endDate);
    return groupingType === 'month';
  }, [startDate, endDate]);

  /**
   * Prepare Sankey diagram data
   * Flow: Income Categories -> Account -> Expense Categories
   */
  const sankeyData = useMemo<SankeyData | null>(() => {
    if (transactions.length === 0) {
      return null;
    }

    // Separate income and expense transactions
    const incomeTransactions = transactions.filter((t) => t.category?.categoryType === 'Income');
    const expenseTransactions = transactions.filter(
      (t) => !t.category || t.category.categoryType === 'Expense'
    );

    // Build node map and links
    const nodeMap = new Map<string, number>();
    const links: Array<{ source: string; target: string; value: number }> = [];

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

  return {
    chartData,
    pieChartData,
    budgetChartData,
    sankeyData,
    chartSeriesKeys,
    hiddenSeries,
    shouldShowStackedChart,
    getSeriesColor,
    handleLegendClick,
    formatCurrencyAbbreviated,
    formatYAxisTick,
  };
}
