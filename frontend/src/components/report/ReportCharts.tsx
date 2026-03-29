/**
 * Report Charts Component
 * Handles chart type selection and rendering of D3-based chart components.
 * Replaces previous recharts-based implementation.
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  IconButton,
  useMediaQuery,
} from '@mui/material';
import {
  ShowChart,
  BarChart as BarChartIcon,
  TrendingUp,
  TrendingDown,
  DonutLarge,
  Layers,
  Timeline,
  ZoomIn,
  Close,
} from '@mui/icons-material';
import { Card } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { D3LineAreaChart } from '../charts/D3LineAreaChart';
import { D3BarChart } from '../charts/D3BarChart';
import { D3DonutChart } from '../charts/D3DonutChart';
import { SankeyChart } from '../SankeyChart';
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
  onChartTypeChange: (
    type: 'line' | 'bar' | 'pie' | 'sankey' | 'stacked' | 'area' | 'categoryBreakdown'
  ) => void;
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
  handleLegendClick,
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

  /**
   * Render chart content based on chart type
   * @param height - Height of the chart container
   * @returns Chart JSX element
   */
  const renderChart = useCallback(
    (height: number): React.JSX.Element => {
      switch (chartType) {
        case 'sankey':
          return sankeyData ? (
            <SankeyChart data={sankeyData} height={height} currency={currency} />
          ) : (
            <Box />
          );

        case 'line':
        case 'area':
          return (
            <D3LineAreaChart
              data={chartData}
              mode={chartType}
              height={height}
              currency={currency}
              hiddenSeries={hiddenSeries}
              onLegendClick={handleLegendClick}
            />
          );

        case 'bar':
          return (
            <D3BarChart
              mode="grouped"
              height={height}
              currency={currency}
              hiddenSeries={hiddenSeries}
              onLegendClick={handleLegendClick}
              chartData={chartData}
              seriesKeys={chartSeriesKeys}
            />
          );

        case 'pie':
          return (
            <D3DonutChart
              data={pieChartData}
              height={height}
              currency={currency}
              hiddenSeries={hiddenSeries}
              onLegendClick={handleLegendClick}
            />
          );

        case 'stacked':
          return (
            <D3BarChart
              mode="stacked"
              height={height}
              currency={currency}
              hiddenSeries={hiddenSeries}
              onLegendClick={handleLegendClick}
              budgetChartData={budgetChartData}
              budgets={budgets}
            />
          );

        case 'categoryBreakdown':
          return (
            <D3BarChart
              mode="horizontal"
              height={height}
              currency={currency}
              hiddenSeries={hiddenSeries}
              onLegendClick={handleLegendClick}
              pieChartData={pieChartData}
            />
          );

        default:
          return <Box />;
      }
    },
    [
      chartType,
      sankeyData,
      currency,
      chartData,
      hiddenSeries,
      handleLegendClick,
      chartSeriesKeys,
      pieChartData,
      budgetChartData,
      budgets,
    ]
  );

  // Don't render if no filters applied, loading, or no transactions
  if (!hasFilters || loading || transactionsLength === 0) {
    return null;
  }

  // Check if chart should be visible based on chart type and data availability
  const shouldShowChart =
    (chartType !== 'sankey' &&
      chartType !== 'pie' &&
      chartType !== 'stacked' &&
      chartData.length > 0) ||
    (chartType === 'pie' && pieChartData.length > 0) ||
    (chartType === 'sankey' && sankeyData !== null) ||
    (chartType === 'stacked' && shouldShowStackedChart);

  if (!shouldShowChart) {
    return null;
  }

  return (
    <>
      <Card sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
                if (
                  value !== null &&
                  typeof value === 'string' &&
                  ['line', 'bar', 'pie', 'sankey', 'stacked', 'area', 'categoryBreakdown'].includes(
                    value
                  )
                ) {
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
              sx={{ ml: 1 }}
            >
              <ZoomIn />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ width: '100%', height: 400 }}>{renderChart(400)}</Box>
        {/* Chart Descriptions - Hidden when printing */}
        <Box
          sx={{
            mt: 2,
            '@media print': {
              display: 'none',
            },
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            {chartType === 'line' &&
              'Visualizes income and expense trends over time to identify patterns and seasonal variations'}
            {chartType === 'area' &&
              'Shows cumulative income and expense trends with filled areas for better visual impact'}
            {chartType === 'pie' &&
              'Shows the proportion of expenses across different categories to identify spending patterns'}
            {chartType === 'stacked' &&
              'Compares budgeted amounts with actual spending to track financial discipline'}
            {chartType === 'categoryBreakdown' &&
              'Displays category spending in horizontal bars for easy comparison of expense amounts'}
            {chartType === 'sankey' &&
              'Illustrates cash flow from income sources through categories to expenses, showing how money moves through your financial system'}
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
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
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
          <Box sx={{ width: '100%', height: '100%', flex: 1, position: 'relative' }}>
            {renderChart(fullscreenHeight)}
          </Box>
        </Box>
      </Dialog>
    </>
  );
}
