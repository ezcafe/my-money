/**
 * Chart Utilities
 * Shared constants, color palette, formatting, and D3 helpers for all chart components.
 */

import * as d3 from 'd3';

// ---------------------------------------------------------------------------
// Color Constants (matching sure app's CSS variables)
// ---------------------------------------------------------------------------

/** Income / success green */
export const COLOR_SUCCESS = '#10A861';

/** Expense / destructive red */
export const COLOR_DESTRUCTIVE = '#EC2222';

/** Gray 400 - default/fallback */
export const COLOR_GRAY_400 = '#9E9E9E';

/** Gray 500 - subdued */
export const COLOR_GRAY_500 = '#737373';

/** Gray 700 - tooltip background */
export const COLOR_GRAY_700 = '#374151';

/**
 * Professional color palette for chart series.
 * Colorblind-friendly, works well for data visualization.
 */
export const SERIES_COLORS: readonly string[] = [
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
] as const;

/**
 * Get a series color by index, cycling through the palette.
 * @param index - Series index
 * @returns Hex color string
 */
export function getSeriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? '#2196F3';
}

// ---------------------------------------------------------------------------
// Formatting Utilities
// ---------------------------------------------------------------------------

/**
 * Format a numeric value with K/M/B abbreviation for axis ticks.
 * @param value - Numeric value
 * @returns Abbreviated string (e.g. "1.2K", "3.5M")
 */
export function formatAxisTick(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return value.toFixed(0);
}

/**
 * Format currency value with abbreviation for tooltips / labels.
 * @param value - Numeric value
 * @param currencyCode - ISO 4217 currency code
 * @returns Formatted string (e.g. "$1.2K")
 */
export function formatCurrencyAbbreviated(value: number, currencyCode: string): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const symbol = getCurrencySymbol(currencyCode);

  if (absValue >= 1_000_000_000) {
    return `${sign}${symbol}${(absValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${symbol}${(absValue / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${symbol}${(absValue / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }

  return `${sign}${symbol}${absValue.toFixed(2)}`;
}

/**
 * Format a currency value with full precision for tooltips.
 * @param value - Numeric value
 * @param currencyCode - ISO 4217 currency code
 * @returns Formatted string (e.g. "$1,234.56")
 */
export function formatCurrencyFull(value: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

/**
 * Get currency symbol from ISO code.
 * @param currencyCode - ISO 4217 currency code
 * @returns Currency symbol (e.g. "$")
 */
export function getCurrencySymbol(currencyCode: string): string {
  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatter.format(0).replace(/[\d\s,.-]/g, '');
  } catch {
    return '$';
  }
}

// ---------------------------------------------------------------------------
// D3 Scale Helpers
// ---------------------------------------------------------------------------

/**
 * Compute nice Y-axis domain with padding, ensuring 0 is included when appropriate.
 * @param data - Array of numeric values
 * @param paddingRatio - Extra padding as a ratio of the data range (default 0.1)
 * @returns [yMin, yMax] tuple
 */
export function computeYDomain(data: number[], paddingRatio = 0.1): [number, number] {
  const dataMin = d3.min(data) ?? 0;
  const dataMax = d3.max(data) ?? 0;

  if (dataMin === dataMax) {
    const padding = dataMax === 0 ? 100 : Math.abs(dataMax) * 0.5;
    return [dataMin - padding, dataMax + padding];
  }

  const range = dataMax - dataMin;
  const padding = range * paddingRatio;

  // Always include 0 when data is non-negative
  const yMin = dataMin >= 0 ? 0 : dataMin - padding;
  const yMax = dataMax + padding;

  return [yMin, yMax];
}

// ---------------------------------------------------------------------------
// Grid / Axis Drawing Helpers
// ---------------------------------------------------------------------------

/**
 * Generate horizontal grid line Y positions.
 * @param yScale - D3 linear scale
 * @param tickCount - Desired number of ticks
 * @returns Array of Y pixel positions
 */
export function getGridYPositions(
  yScale: d3.ScaleLinear<number, number>,
  tickCount = 5
): number[] {
  return yScale.ticks(tickCount).map((tick) => yScale(tick));
}

/**
 * Compute margin for chart area to accommodate axis labels.
 */
export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Default chart margins */
export const DEFAULT_MARGIN: ChartMargin = {
  top: 16,
  right: 16,
  bottom: 32,
  left: 48,
};
