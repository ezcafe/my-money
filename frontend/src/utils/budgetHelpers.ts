/**
 * Budget Helper Utilities
 * Utility functions for budget-related calculations and UI helpers
 */

import React from 'react';
import {CheckCircle, Warning, Error as ErrorIcon, AccountBalance, Category, Person} from '@mui/icons-material';

/**
 * Get progress color based on usage percentage
 * @param percentage - Budget usage percentage (0-100+)
 * @returns Color variant for progress indicators
 */
export function getProgressColor(percentage: number): 'success' | 'warning' | 'error' {
  if (percentage < 50) return 'success';
  if (percentage < 80) return 'warning';
  return 'error';
}

/**
 * Get status icon based on usage percentage
 * @param percentage - Budget usage percentage (0-100+)
 * @returns React icon component
 */
export function getStatusIcon(percentage: number): React.JSX.Element {
  if (percentage < 50) {
    return React.createElement(CheckCircle, {sx: {color: 'success.main', fontSize: 20}});
  }
  if (percentage < 80) {
    return React.createElement(Warning, {sx: {color: 'warning.main', fontSize: 20}});
  }
  return React.createElement(ErrorIcon, {sx: {color: 'error.main', fontSize: 20}});
}

/**
 * Get budget type icon based on budget configuration
 * @param accountId - Account ID if budget is for an account
 * @param categoryId - Category ID if budget is for a category
 * @param payeeId - Payee ID if budget is for a payee
 * @returns React icon component
 */
export function getBudgetTypeIcon(accountId: string | null, categoryId: string | null, _payeeId: string | null): React.JSX.Element {
  if (accountId) {
    return React.createElement(AccountBalance, {sx: {fontSize: 18, mr: 0.5}});
  }
  if (categoryId) {
    return React.createElement(Category, {sx: {fontSize: 18, mr: 0.5}});
  }
  return React.createElement(Person, {sx: {fontSize: 18, mr: 0.5}});
}
