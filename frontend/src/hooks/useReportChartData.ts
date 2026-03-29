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
import { getCurrencySymbol, COLOR_SUCCESS, COLOR_GRAY_500 } from '../components/charts/chartUtils';
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
 * Sankey node data (matching sure app's pattern)
 */
export interface SankeyNodeData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

/**
 * Sankey link data (matching sure app's pattern)
 */
export interface SankeyLinkData {
  source: number;
  target: number;
  value: number;
  color: string;
  percentage: number;
}

/**
 * Sankey chart data (matching sure app's pattern)
 * Flow: Income Categories -> Cash Flow -> Expense Categories -> Surplus
 */
export interface SankeyData {
  nodes: SankeyNodeData[];
  links: SankeyLinkData[];
  currencySymbol: string;
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
   * Flow: Income Categories -> Cash Flow (central) -> Expense Categories -> Surplus
   * Follows sure app's build_cashflow_sankey_data pattern.
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

    // Aggregate income by category
    const incomeByCategory = new Map<string, number>();
    for (const t of incomeTransactions) {
      const name = t.category?.name ?? 'Uncategorized';
      incomeByCategory.set(name, (incomeByCategory.get(name) ?? 0) + Number(t.value));
    }

    // Aggregate expenses by category
    const expenseByCategory = new Map<string, number>();
    for (const t of expenseTransactions) {
      const name = t.category?.name ?? 'Uncategorized';
      expenseByCategory.set(name, (expenseByCategory.get(name) ?? 0) + Math.abs(Number(t.value)));
    }

    const totalIncome = Array.from(incomeByCategory.values()).reduce((s, v) => s + v, 0);
    const totalExpense = Array.from(expenseByCategory.values()).reduce((s, v) => s + v, 0);

    if (totalIncome === 0 && totalExpense === 0) return null;

    // Build nodes and links following sure app pattern
    const nodes: SankeyData['nodes'] = [];
    const links: SankeyData['links'] = [];
    const nodeIndices = new Map<string, number>();

    const addNode = (key: string, name: string, value: number, percentage: number, color: string): number => {
      if (nodeIndices.has(key)) return nodeIndices.get(key)!;
      const idx = nodes.length;
      nodes.push({ name, value: Math.round(value * 100) / 100, percentage: Math.round(percentage * 10) / 10, color });
      nodeIndices.set(key, idx);
      return idx;
    };

    // Central "Cash Flow" node
    const cashFlowIdx = addNode('cash_flow', 'Cash Flow', totalIncome, 100, COLOR_SUCCESS);

    // Income categories -> Cash Flow (inbound)
    const sortedIncome = Array.from(incomeByCategory.entries()).sort((a, b) => b[1] - a[1]);
    for (const [catName, value] of sortedIncome) {
      if (value <= 0) continue;
      const pct = totalIncome > 0 ? (value / totalIncome) * 100 : 0;
      const idx = addNode(`income_${catName}`, catName, value, pct, COLOR_SUCCESS);
      links.push({ source: idx, target: cashFlowIdx, value, color: COLOR_SUCCESS, percentage: Math.round(pct * 10) / 10 });
    }

    // Cash Flow -> Expense categories (outbound)
    const sortedExpense = Array.from(expenseByCategory.entries()).sort((a, b) => b[1] - a[1]);
    for (const [catName, value] of sortedExpense) {
      if (value <= 0) continue;
      const pct = totalExpense > 0 ? (value / totalExpense) * 100 : 0;
      const idx = addNode(`expense_${catName}`, catName, value, pct, COLOR_GRAY_500);
      links.push({ source: cashFlowIdx, target: idx, value, color: COLOR_GRAY_500, percentage: Math.round(pct * 10) / 10 });
    }

    // Surplus node if income > expenses
    const net = totalIncome - totalExpense;
    if (net > 0) {
      const pct = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
      const surplusIdx = addNode('surplus', 'Surplus', net, pct, COLOR_SUCCESS);
      links.push({ source: cashFlowIdx, target: surplusIdx, value: net, color: COLOR_SUCCESS, percentage: Math.round(pct * 10) / 10 });
    }

    if (links.length === 0) return null;

    return {
      nodes,
      links,
      currencySymbol: getCurrencySymbol(_currency),
    };
  }, [transactions, _currency]);

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
