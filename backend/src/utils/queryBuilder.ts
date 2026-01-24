/**
 * Query Builder Utilities
 * Common functions for building database queries
 */

import type { Prisma } from '@prisma/client';

/**
 * Build Prisma orderBy clause from GraphQL orderBy input
 * @param orderBy - GraphQL orderBy input
 * @returns Prisma orderBy clause
 */
export function buildOrderBy(orderBy?: {
  field: 'date' | 'value' | 'category' | 'account' | 'payee';
  direction: 'asc' | 'desc';
}): Prisma.TransactionOrderByWithRelationInput {
  const orderField = orderBy?.field ?? 'date';
  const orderDirection = orderBy?.direction ?? 'desc';

  switch (orderField) {
    case 'date':
      return { date: orderDirection };
    case 'value':
      return { value: orderDirection };
    case 'category':
      return { category: { name: orderDirection } };
    case 'account':
      return { account: { name: orderDirection } };
    case 'payee':
      return { payee: { name: orderDirection } };
    default:
      return { date: orderDirection };
  }
}

/**
 * Build where clause for transaction filters
 * @param filters - Filter options
 * @param workspaceId - Workspace ID
 * @returns Prisma where clause
 */
export function buildTransactionWhere(
  filters: {
    accountId?: string;
    categoryId?: string;
    payeeId?: string;
    note?: string;
    startDate?: Date;
    endDate?: Date;
    accountIds?: string[];
    categoryIds?: string[];
    payeeIds?: string[];
    memberIds?: string[];
  },
  workspaceId: string
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {
    account: { workspaceId },
  };

  // Filter by memberIds if provided (createdBy or lastEditedBy)
  if (filters.memberIds && filters.memberIds.length > 0) {
    where.OR = [
      { createdBy: { in: filters.memberIds } },
      { lastEditedBy: { in: filters.memberIds } },
    ];
  }

  if (filters.accountId) {
    where.accountId = filters.accountId;
  } else if (filters.accountIds && filters.accountIds.length > 0) {
    where.accountId = { in: filters.accountIds };
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  } else if (filters.categoryIds && filters.categoryIds.length > 0) {
    where.categoryId = { in: filters.categoryIds };
  }

  if (filters.payeeId) {
    where.payeeId = filters.payeeId;
  } else if (filters.payeeIds && filters.payeeIds.length > 0) {
    where.payeeId = { in: filters.payeeIds };
  }

  if (filters.note) {
    where.note = {
      contains: filters.note,
      mode: 'insensitive',
    };
  }

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) {
      where.date.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.date.lte = filters.endDate;
    }
  }

  return where;
}
