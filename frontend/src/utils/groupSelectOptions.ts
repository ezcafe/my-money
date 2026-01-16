/**
 * Utility functions for grouping select options
 * Groups accounts by accountType and categories by type
 */

import type {Account} from '../hooks/useAccounts';
import type {Category} from '../hooks/useCategories';

/**
 * Account type label mapping
 */
export const ACCOUNT_TYPE_LABELS: Record<Account['accountType'], string> = {
  Cash: 'Cash',
  CreditCard: 'Credit Card',
  Bank: 'Bank',
  Saving: 'Saving',
  Loans: 'Loans',
};

/**
 * Category type label mapping
 */
export const CATEGORY_TYPE_LABELS: Record<Category['categoryType'], string> = {
  Income: 'Income',
  Expense: 'Expense',
};

/**
 * Grouped account structure
 */
export interface GroupedAccount {
  type: Account['accountType'];
  label: string;
  items: Account[];
}

/**
 * Grouped category structure
 */
export interface GroupedCategory {
  type: Category['categoryType'];
  label: string;
  items: Category[];
}

/**
 * Account type order for consistent grouping
 */
const ACCOUNT_TYPE_ORDER: Account['accountType'][] = ['Cash', 'Bank', 'CreditCard', 'Saving', 'Loans'];

/**
 * Category type order for consistent grouping
 */
const CATEGORY_TYPE_ORDER: Category['categoryType'][] = ['Income', 'Expense'];

/**
 * Shared styling for Autocomplete group headers
 * Makes group titles smaller, lighter, and less prominent
 */
export const GROUP_HEADER_STYLES = {
  '& .MuiListSubheader-root': {
    fontSize: '0.7rem',
    fontWeight: 400,
    opacity: 0.6,
    lineHeight: 1.2,
    py: 0.5,
  },
};

/**
 * Helper function for type-safe account type label access
 * @param accountType - The account type
 * @returns The label for the account type
 */
export function getAccountTypeLabel(accountType: Account['accountType']): string {
  return (ACCOUNT_TYPE_LABELS[accountType] as string | undefined) ?? accountType;
}

/**
 * Helper function for type-safe category type label access
 * @param categoryType - The category type
 * @returns The label for the category type
 */
export function getCategoryTypeLabel(categoryType: Category['categoryType']): string {
  return (CATEGORY_TYPE_LABELS[categoryType] as string | undefined) ?? categoryType;
}

/**
 * Groups accounts by accountType
 * @param accounts - Array of accounts to group
 * @returns Array of grouped accounts with type, label, and items
 */
export function groupAccountsByType(accounts: Account[]): GroupedAccount[] {
  const grouped = new Map<Account['accountType'], Account[]>();

  // Group accounts by type
  for (const account of accounts) {
    const type = account.accountType;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(account);
  }

  // Convert to array and sort by predefined order
  return ACCOUNT_TYPE_ORDER.map((type) => {
    const items = grouped.get(type) ?? [];
    return {
      type,
      label: ACCOUNT_TYPE_LABELS[type],
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }).filter((group) => group.items.length > 0);
}

/**
 * Groups categories by type
 * @param categories - Array of categories to group
 * @returns Array of grouped categories with type, label, and items
 */
export function groupCategoriesByType(categories: Category[]): GroupedCategory[] {
  const grouped = new Map<Category['categoryType'], Category[]>();

  // Group categories by type
  for (const category of categories) {
    const type = category.categoryType;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(category);
  }

  // Convert to array and sort by predefined order
  return CATEGORY_TYPE_ORDER.map((type) => {
    const items = grouped.get(type) ?? [];
    return {
      type,
      label: CATEGORY_TYPE_LABELS[type],
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }).filter((group) => group.items.length > 0);
}
