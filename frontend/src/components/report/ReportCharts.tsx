/**
 * Report Charts Component
 * Handles chart type selection and rendering of various chart types
 */

import React, {useCallback, useMemo, use, useState, useEffect} from 'react';
import {Box, Typography, ToggleButton, ToggleButtonGroup, CircularProgress, useTheme, IconButton, useMediaQuery} from '@mui/material';
import {ShowChart, BarChart as BarChartIcon, TrendingUp, TrendingDown, DonutLarge, Layers, Timeline, ZoomIn, Close} from '@mui/icons-material';
import {Card} from '../ui/Card';
import {SankeyChart} from '../SankeyChart';
import {Dialog} from '../ui/Dialog';
import type {
  ChartDataPoint,
  PieChartDataPoint,
  BudgetChartDataPoint,
  SankeyData,
} from '../../hooks/useReportChartData';

/**
 * Budget type
 */
interface Budget {
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
 * ReportCharts component props
 */
interface ReportChartsProps {
  chartType: 'line' | 'bar' | 'pie' | 'sankey' | 'stacked' | 'area' | 'categoryBreakdown';
  onChartTypeChange: (type: 'line' | 'bar' | 'pie' | 'sankey' | 'stacked' | 'area' | 'categoryBreakdown') => void;
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
  budgets: Budget[];
  currency: string;
  hasFilters: boolean;
  loading: boolean;
  transactionsLength: number;
}

/**
 * Custom chart tooltip formatter for multiple series
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    dataKey: string;
    color?: string;
    payload?: ChartDataPoint;
  }>;
  currency: string;
  formatCurrencyAbbreviated: (value: number, currencyCode: string) => string;
}

/**
 * Custom Tooltip Component
 */
const CustomTooltip = ({active, payload, currency, formatCurrencyAbbreviated}: CustomTooltipProps): React.JSX.Element | null => {
  if (active && payload && payload.length > 0) {
    const payloadData = payload[0]?.payload;
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
              sx={{color: entry.color ?? 'text.primary', mb: 0.5}}
            >
              {entry.name}: {formatCurrencyAbbreviated(Number(entry.value), currency)}
            </Typography>
          );
        })}
      </Box>
    );
  }
  return null;
};

/**
 * Report Charts Component
 */
export function ReportCharts({
  chartType,
  onChartTypeChange,
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
  budgets,
  currency,
  hasFilters,
  loading,
  transactionsLength,
}: ReportChartsProps): React.JSX.Element | null {
  const theme = useTheme();
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [fullscreenHeight, setFullscreenHeight] = useState(600);

  /**
   * Calculate fullscreen height based on viewport
   */
  useEffect(() => {
    if (!fullscreenOpen) {
      return;
    }

    const calculateHeight = (): void => {
      const headerHeight = isMobile ? 120 : 200;
      const padding = isMobile ? 32 : 48;
      const calculatedHeight = window.innerHeight - headerHeight - padding;
      setFullscreenHeight(Math.max(calculatedHeight, 400));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    window.addEventListener('orientationchange', calculateHeight);

    return () => {
      window.removeEventListener('resize', calculateHeight);
      window.removeEventListener('orientationchange', calculateHeight);
    };
  }, [fullscreenOpen, isMobile]);

  // Dynamic imports for heavy dependencies
  // Use React.use() for dynamic import of recharts
  // This replaces useEffect + useState pattern with React 19's use() hook
  const rechartsPromise = useMemo(() => import('recharts'), []);
  const recharts = use(rechartsPromise);

  const rechartsComponents = useMemo(() => ({
    LineChart: recharts.LineChart,
    Line: recharts.Line,
    BarChart: recharts.BarChart,
    Bar: recharts.Bar,
    PieChart: recharts.PieChart,
    Pie: recharts.Pie,
    Cell: recharts.Cell,
    XAxis: recharts.XAxis,
    YAxis: recharts.YAxis,
    CartesianGrid: recharts.CartesianGrid,
    Tooltip: recharts.Tooltip,
    Legend: recharts.Legend,
    ResponsiveContainer: recharts.ResponsiveContainer,
    AreaChart: recharts.AreaChart,
    Area: recharts.Area,
  }), [recharts]);

  // Memoize CustomTooltip with currency and formatter
  const CustomTooltipMemo = useCallback(
    (props: {active?: boolean; payload?: Array<{name: string; value: number; dataKey: string; color?: string; payload?: ChartDataPoint}>}) => (
      <CustomTooltip {...props} currency={currency} formatCurrencyAbbreviated={formatCurrencyAbbreviated} />
    ),
    [currency, formatCurrencyAbbreviated],
  );

  /**
   * Render chart content
   * @param height - Height of the chart container
   * @returns Chart JSX element
   */
  const renderChart = useCallback(
    (height: number): React.JSX.Element => {
      if (!rechartsComponents) {
        return (
          <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
            <CircularProgress />
          </Box>
        );
      }

      if (chartType === 'sankey') {
        return sankeyData ? <SankeyChart data={sankeyData} height={height} currency={currency} /> : <Box />;
      }

      if (chartType === 'pie') {
        return (
          <rechartsComponents.ResponsiveContainer width="100%" height="100%">
            <rechartsComponents.PieChart>
              <rechartsComponents.Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({name, percent}: {name: string; percent: number}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={height < 600 ? 120 : 180}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((item, index) => {
                  const baseColor = getSeriesColor(index);
                  const opacity = hiddenSeries.has(item.name) ? 0.3 : 1;
                  return <rechartsComponents.Cell key={`cell-${item.name}`} fill={baseColor} opacity={opacity} />;
                })}
              </rechartsComponents.Pie>
              <rechartsComponents.Tooltip
                formatter={(value: unknown): string => formatCurrencyAbbreviated(Number(value), currency)}
              />
              <rechartsComponents.Legend
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
            </rechartsComponents.PieChart>
          </rechartsComponents.ResponsiveContainer>
        );
      }

      if (chartType === 'stacked') {
        if (budgetChartData.length === 0) {
          return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2}}>
              <Typography variant="body2" color="text.secondary">
                No budget data available for the selected period
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{opacity: 0.7}}>
                Create budgets and add expense transactions to see budget vs actual comparison
              </Typography>
            </Box>
          );
        }

        return (
          <rechartsComponents.ResponsiveContainer width="100%" height="100%">
            <rechartsComponents.BarChart data={budgetChartData}>
              <rechartsComponents.CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
              <rechartsComponents.XAxis
                dataKey="month"
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.YAxis
                tickFormatter={formatYAxisTick}
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.Tooltip content={<CustomTooltipMemo />} />
              <rechartsComponents.Legend
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
                      <rechartsComponents.Bar
                        dataKey={budgetKey}
                        stackId="budget"
                        fill={getSeriesColor(index * 2)}
                        name={`${categoryName} (Budget)`}
                        radius={[0, 0, 0, 0]}
                        opacity={budgetOpacity}
                      />
                      <rechartsComponents.Bar
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
            </rechartsComponents.BarChart>
          </rechartsComponents.ResponsiveContainer>
        );
      }

      if (chartType === 'area' && rechartsComponents?.AreaChart !== undefined && rechartsComponents?.Area !== undefined) {
        return (
          <rechartsComponents.ResponsiveContainer width="100%" height="100%">
            <rechartsComponents.AreaChart data={chartData}>
              <rechartsComponents.CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
              <rechartsComponents.XAxis
                dataKey="date"
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.YAxis
                tickFormatter={formatYAxisTick}
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.Tooltip content={<CustomTooltipMemo />} />
              <rechartsComponents.Legend
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
              <rechartsComponents.Area
                type="monotone"
                dataKey="income"
                stackId="1"
                stroke={theme.palette.success.main}
                fill={theme.palette.success.main}
                name="Income"
                fillOpacity={hiddenSeries.has('income') ? 0.1 : 0.6}
                strokeOpacity={hiddenSeries.has('income') ? 0.3 : 1}
              />
              <rechartsComponents.Area
                type="monotone"
                dataKey="expense"
                stackId="2"
                stroke={theme.palette.error.main}
                fill={theme.palette.error.main}
                name="Expense"
                fillOpacity={hiddenSeries.has('expense') ? 0.1 : 0.6}
                strokeOpacity={hiddenSeries.has('expense') ? 0.3 : 1}
              />
            </rechartsComponents.AreaChart>
          </rechartsComponents.ResponsiveContainer>
        );
      }

      if (chartType === 'categoryBreakdown') {
        return (
          <rechartsComponents.ResponsiveContainer width="100%" height="100%">
            <rechartsComponents.BarChart data={pieChartData} layout="vertical">
              <rechartsComponents.CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
              <rechartsComponents.XAxis
                type="number"
                tickFormatter={formatYAxisTick}
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.YAxis
                type="category"
                dataKey="name"
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.Tooltip
                formatter={(value: unknown): string => formatCurrencyAbbreviated(Number(value), currency)}
              />
              <rechartsComponents.Bar
                dataKey="value"
                fill={theme.palette.primary.main}
                radius={[0, 4, 4, 0]}
              >
                {pieChartData.map((item, index) => {
                  const baseColor = getSeriesColor(index);
                  const opacity = hiddenSeries.has(item.name) ? 0.3 : 1;
                  return <rechartsComponents.Cell key={`cell-${item.name}`} fill={baseColor} opacity={opacity} />;
                })}
              </rechartsComponents.Bar>
            </rechartsComponents.BarChart>
          </rechartsComponents.ResponsiveContainer>
        );
      }

      // Default: line or bar chart
      return (
        <rechartsComponents.ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <rechartsComponents.LineChart data={chartData}>
              <rechartsComponents.CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
              <rechartsComponents.XAxis
                dataKey="date"
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.YAxis
                tickFormatter={formatYAxisTick}
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.Tooltip content={<CustomTooltipMemo />} />
              <rechartsComponents.Legend
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
              <rechartsComponents.Line
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
              <rechartsComponents.Line
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
            </rechartsComponents.LineChart>
          ) : (
            <rechartsComponents.BarChart data={chartData}>
              <rechartsComponents.CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} opacity={0.3} />
              <rechartsComponents.XAxis
                dataKey="date"
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.YAxis
                tickFormatter={formatYAxisTick}
                stroke={theme.palette.text.secondary}
                tick={{fill: theme.palette.text.secondary, fontSize: 12, opacity: 0.5}}
              />
              <rechartsComponents.Tooltip content={<CustomTooltipMemo />} />
              <rechartsComponents.Legend
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
                  <rechartsComponents.Bar
                    key={seriesKey}
                    dataKey={seriesKey}
                    fill={getSeriesColor(index)}
                    name={seriesKey}
                    radius={[4, 4, 0, 0]}
                    opacity={opacity}
                  />
                );
              })}
            </rechartsComponents.BarChart>
          )}
        </rechartsComponents.ResponsiveContainer>
      );
    },
    [
      rechartsComponents,
      chartType,
      sankeyData,
      currency,
      pieChartData,
      getSeriesColor,
      hiddenSeries,
      formatCurrencyAbbreviated,
      handleLegendClick,
      budgetChartData,
      theme,
      formatYAxisTick,
      budgets,
      chartData,
      chartSeriesKeys,
      CustomTooltipMemo,
    ],
  );

  // Don't render if no filters applied, loading, or no transactions
  if (!hasFilters || loading || transactionsLength === 0) {
    return null;
  }

  // Check if chart should be visible based on chart type and data availability
  const shouldShowChart =
    (chartType !== 'sankey' && chartType !== 'pie' && chartType !== 'stacked' && chartData.length > 0) ||
    (chartType === 'pie' && pieChartData.length > 0) ||
    (chartType === 'sankey' && sankeyData !== null) ||
    (chartType === 'stacked' && shouldShowStackedChart);

  if (!shouldShowChart) {
    return null;
  }

  /**
   * Handle mobile orientation change for fullscreen mode
   * The chart will automatically adapt to orientation changes through responsive sizing
   */

  return (
    <>
      <Card sx={{p: 3, mb: 3}}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
          <Typography variant="h6" component="h2">
            Trends
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '@media print': {
                display: 'none',
              },
            }}
          >
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => {
                if (value !== null && typeof value === 'string' && ['line', 'bar', 'pie', 'sankey', 'stacked', 'area', 'categoryBreakdown'].includes(value)) {
                  onChartTypeChange(value as typeof chartType);
                }
              }}
              size="small"
            >
              <ToggleButton value="line" aria-label="Line chart">
                <ShowChart />
              </ToggleButton>
              <ToggleButton value="area" aria-label="Area chart">
                <TrendingUp />
              </ToggleButton>
              <ToggleButton value="bar" aria-label="Bar chart">
                <BarChartIcon />
              </ToggleButton>
              <ToggleButton value="pie" aria-label="Pie chart">
                <DonutLarge />
              </ToggleButton>
              {shouldShowStackedChart ? (
                <ToggleButton value="stacked" aria-label="Stacked column chart">
                  <Layers />
                </ToggleButton>
              ) : null}
              <ToggleButton value="categoryBreakdown" aria-label="Category breakdown">
                <TrendingDown />
              </ToggleButton>
              <ToggleButton value="sankey" aria-label="Cash flow chart">
                <Timeline />
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton
              onClick={() => {
                setFullscreenOpen(true);
              }}
              size="small"
              aria-label="Zoom chart to fullscreen"
              sx={{ml: 1}}
            >
              <ZoomIn />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{width: '100%', height: 400}}>
          {renderChart(400)}
        </Box>
        {/* Chart Descriptions - Hidden when printing */}
        <Box
          sx={{
            mt: 2,
            '@media print': {
              display: 'none',
            },
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{fontSize: '0.875rem'}}>
            {chartType === 'line' && 'Visualizes income and expense trends over time to identify patterns and seasonal variations'}
            {chartType === 'area' && 'Shows cumulative income and expense trends with filled areas for better visual impact'}
            {chartType === 'pie' && 'Shows the proportion of expenses across different categories to identify spending patterns'}
            {chartType === 'stacked' && 'Compares budgeted amounts with actual spending to track financial discipline'}
            {chartType === 'categoryBreakdown' && 'Displays category spending in horizontal bars for easy comparison of expense amounts'}
            {chartType === 'sankey' && 'Illustrates cash flow from income sources through categories to expenses, showing how money moves through your financial system'}
            {chartType === 'bar' && 'Displays transaction data in bar format for easy comparison'}
          </Typography>
        </Box>
      </Card>

      {/* Fullscreen Chart Dialog */}
      <Dialog
        open={fullscreenOpen}
        onClose={() => {
          setFullscreenOpen(false);
        }}
        fullScreen={isMobile}
        maxWidth={false}
        PaperProps={{
          sx: {
            ...(isMobile
              ? {
                  m: 0,
                  height: '100vh',
                  maxHeight: '100vh',
                  borderRadius: 0,
                }
              : {
                  m: 2,
                  width: 'calc(100% - 64px)',
                  height: 'calc(100% - 64px)',
                  maxWidth: 'none',
                  maxHeight: 'calc(100vh - 64px)',
                }),
          },
        }}
        title={
          <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
            <Typography variant="h6">Chart - Fullscreen</Typography>
            <IconButton
              onClick={() => {
                setFullscreenOpen(false);
              }}
              aria-label="Close fullscreen"
              size="small"
            >
              <Close />
            </IconButton>
          </Box>
        }
      >
        <Box
          sx={{
            width: '100%',
            height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 200px)',
            minHeight: isMobile ? 400 : 600,
            p: isMobile ? 2 : 3,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{width: '100%', height: '100%', flex: 1, position: 'relative'}}>
            {renderChart(fullscreenHeight)}
          </Box>
        </Box>
      </Dialog>
    </>
  );
}
