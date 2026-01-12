/**
 * Formatting utility functions
 * Shared formatting functions for currency, dates, and numbers
 */

import type {DateFormat} from '../contexts/DateFormatContext';
import {DEFAULT_DATE_FORMAT} from '../contexts/DateFormatContext';

/**
 * Minimal transaction interface for date grouping
 * Only requires id and date properties
 */
interface Transaction {
  id: string;
  date: Date | string;
}

/**
 * Format a date according to the specified format pattern
 * @param date - The date to format (Date object or string)
 * @param format - The date format pattern (e.g., 'MM/DD/YYYY')
 * @returns Formatted date string
 */
function formatDateByPattern(date: Date | string, format: DateFormat): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    default:
      return `${month}/${day}/${year}`;
  }
}

/**
 * Format a number as currency
 * @param value - The numeric value to format
 * @param currency - The currency code (default: 'USD')
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Format a date to a readable string
 * Uses a readable format (e.g., "Jan 15, 2024") regardless of date format preference
 * @param date - The date to format (Date object or string)
 * @param _dateFormat - Optional date format pattern (not used for this function, kept for API consistency)
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, _dateFormat?: DateFormat): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Format a date to a short locale string
 * @param date - The date to format (Date object or string)
 * @param dateFormat - Optional date format pattern (defaults to MM/DD/YYYY)
 * @returns Formatted date string according to the specified format
 */
export function formatDateShort(date: Date | string, dateFormat: DateFormat = DEFAULT_DATE_FORMAT): string {
  return formatDateByPattern(date, dateFormat);
}

/**
 * Format a number as currency preserving original decimal precision
 * If value has .00, shows it. If not, doesn't add .00
 * @param value - The numeric value to format (can be number or Decimal string)
 * @param currency - The currency code (default: 'USD')
 * @returns Formatted currency string preserving original decimal places
 */
export function formatCurrencyPreserveDecimals(value: number | string, currency: string = 'USD'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Convert to string to check decimal places from original value
  const valueStr = typeof value === 'string' ? value : String(value);

  // Check if original string representation has .00 or .0
  const hasExplicitZeroDecimals = typeof value === 'string' &&
    valueStr.includes('.') &&
    (valueStr.endsWith('.00') || valueStr.endsWith('.0'));

  // Check if value is a whole number (no decimal part)
  const isWholeNumber = Number.isInteger(numValue) || (numValue % 1 === 0);

  // Determine minimum and maximum fraction digits
  let minFractionDigits = 0;
  let maxFractionDigits = 0;

  if (hasExplicitZeroDecimals) {
    // If original value has .00, show 2 decimal places
    minFractionDigits = 2;
    maxFractionDigits = 2;
  } else if (!isWholeNumber) {
    // If value has non-zero decimals, show them (up to 2)
    const decimalPart = valueStr.includes('.') ? (valueStr.split('.')[1] ?? '') : '';
    const decimalLength = Math.min(decimalPart.length, 2);
    minFractionDigits = decimalLength;
    maxFractionDigits = decimalLength;
  }
  // If it's a whole number without explicit .00, show no decimals (minFractionDigits = 0)

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(numValue);
}

/**
 * Get a normalized date key (YYYY-MM-DD) for grouping transactions
 * @param date - The date to normalize (Date object or string)
 * @returns Date key in YYYY-MM-DD format
 */
export function getDateKey(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if two dates are on the same calendar day
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @returns True if dates are on the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Group transactions by date
 * @param transactions - Array of transactions to group
 * @returns Map of date keys (YYYY-MM-DD) to arrays of transactions
 */
export function groupTransactionsByDate<T extends Transaction>(
  transactions: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const transaction of transactions) {
    const dateKey = getDateKey(transaction.date);
    const existing = grouped.get(dateKey) ?? [];
    existing.push(transaction);
    grouped.set(dateKey, existing);
  }

  return grouped;
}

/**
 * Format a date header with smart labels
 * Returns "Today" for current date, "Yesterday" for previous date,
 * or a formatted date string for older dates using the user's preferred format
 * @param date - The date to format (Date object or string)
 * @param dateFormat - Optional date format pattern (defaults to MM/DD/YYYY)
 * @returns Formatted date header string
 */
export function formatDateHeader(date: Date | string, dateFormat: DateFormat = DEFAULT_DATE_FORMAT): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(dateObj, today)) {
    return 'Today';
  }

  if (isSameDay(dateObj, yesterday)) {
    return 'Yesterday';
  }

  // For older dates, use the user's preferred date format
  return formatDateShort(dateObj, dateFormat);
}

/**
 * Format a number with abbreviation (K, M, B, etc.)
 * Examples: 1000 -> 1K, 32000000 -> 32M, 1500000000 -> 1.5B
 * @param value - The numeric value to format
 * @returns Formatted number string with abbreviation
 */
export function formatNumberAbbreviation(value: number): string {
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
  return String(value);
}
