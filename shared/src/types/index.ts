/**
 * Shared types for My Money application
 * Used by both frontend and backend for type safety
 */

export interface User {
  id: string;
  oidcSubject: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  name: string;
  initBalance: number;
  isDefault: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  value: number;
  date: Date;
  accountId: string;
  categoryId?: string | null;
  payeeId?: string | null;
  note?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  isDefault: boolean;
  userId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payee {
  id: string;
  name: string;
  icon?: string | null;
  isDefault: boolean;
  userId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringTransaction {
  id: string;
  cronExpression: string;
  value: number;
  accountId: string;
  categoryId?: string | null;
  payeeId?: string | null;
  note?: string | null;
  nextRunDate: Date;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  currency: string;
  useThousandSeparator: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationArgs {
  skip?: number;
  take?: number;
  first?: number;
  after?: string;
}

export interface PaginationResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface ReportFilters {
  accountIds?: string[];
  categoryIds?: string[];
  payeeIds?: string[];
  startDate?: Date;
  endDate?: Date;
}









