/**
 * Transaction Repository
 * Handles all database operations for transactions
 */

import type {Prisma, PrismaClient, Transaction} from '@prisma/client';
import {Prisma as PrismaNamespace} from '@prisma/client';
import {BaseRepository} from './BaseRepository';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Transaction Repository
 * Provides data access methods for transactions
 */
export class TransactionRepository extends BaseRepository {
  /**
   * Find transaction by ID in workspace (via account)
   * @param id - Transaction ID
   * @param workspaceId - Workspace ID (via account)
   * @param select - Optional select clause
   * @param include - Optional include clause
   * @returns Transaction if found, null otherwise
   */
  async findById(
    id: string,
    workspaceId: string,
    select?: Record<string, boolean>,
    include?: Prisma.TransactionInclude,
  ): Promise<Transaction | null> {
    const queryOptions: {
      where: {id: string; account: {workspaceId: string}};
      select?: Record<string, boolean>;
      include?: Prisma.TransactionInclude;
    } = {
      where: {
        id,
        account: {workspaceId},
      },
    };

    if (select) {
      queryOptions.select = select;
    } else if (include) {
      queryOptions.include = include;
    }

    return this.prisma.transaction.findFirst(queryOptions);
  }

  /**
   * Find many transactions with filters
   * @param where - Where clause
   * @param options - Query options (skip, take, orderBy, select, include)
   * @returns Array of transactions
   */
  async findMany(
    where: Prisma.TransactionWhereInput,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.TransactionOrderByWithRelationInput;
      select?: Record<string, boolean>;
      include?: Prisma.TransactionInclude;
    },
  ): Promise<Transaction[]> {
    const queryOptions: Prisma.TransactionFindManyArgs = {
      where,
      ...options,
    };

    return this.prisma.transaction.findMany(queryOptions);
  }

  /**
   * Create a new transaction
   * @param data - Transaction data
   * @param tx - Optional transaction client
   * @returns Created transaction
   */
  async create(
    data: {
      value: number;
      date: Date;
      accountId: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
      createdBy: string;
      lastEditedBy: string;
    },
    tx?: PrismaTransaction,
  ): Promise<Transaction> {
    const client = tx ?? this.prisma;
    return client.transaction.create({data});
  }

  /**
   * Create many transactions
   * @param data - Array of transaction data
   * @param tx - Optional transaction client
   * @returns Count of created transactions
   */
  async createMany(
    data: Array<{
      value: number;
      date: Date;
      accountId: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
      createdBy: string;
      lastEditedBy: string;
    }>,
    tx?: PrismaTransaction,
  ): Promise<{count: number}> {
    const client = tx ?? this.prisma;
    return client.transaction.createMany({data});
  }

  /**
   * Update a transaction
   * @param id - Transaction ID
   * @param data - Transaction data to update
   * @param tx - Optional transaction client
   * @returns Updated transaction
   */
  async update(
    id: string,
    data: {
      value?: number;
      date?: Date;
      accountId?: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
      lastEditedBy?: string;
    },
    tx?: PrismaTransaction,
  ): Promise<Transaction> {
    const client = tx ?? this.prisma;
    return client.transaction.update({
      where: {id},
      data,
    });
  }

  /**
   * Delete a transaction
   * @param id - Transaction ID
   * @param tx - Optional transaction client
   * @returns Deleted transaction
   */
  async delete(id: string, tx?: PrismaTransaction): Promise<Transaction> {
    const client = tx ?? this.prisma;
    return client.transaction.delete({
      where: {id},
    });
  }

  /**
   * Count transactions
   * @param where - Where clause
   * @returns Count of transactions
   */
  async count(where: Prisma.TransactionWhereInput): Promise<number> {
    return this.prisma.transaction.count({where});
  }

  /**
   * Aggregate transactions
   * @param where - Where clause
   * @param aggregate - Aggregate options
   * @returns Aggregate result
   */
  async aggregate(
    where: Prisma.TransactionWhereInput,
    aggregate: Prisma.TransactionAggregateArgs,
  ): Promise<Prisma.GetTransactionAggregateType<typeof aggregate>> {
    return this.prisma.transaction.aggregate({
      ...aggregate,
      where,
    });
  }

  /**
   * Group transactions by field
   * @param by - Fields to group by
   * @param where - Where clause
   * @param aggregate - Aggregate options
   * @returns Grouped results
   */
  async groupBy(
    by: Prisma.TransactionScalarFieldEnum[],
    where: Prisma.TransactionWhereInput,
    aggregate?: Omit<Prisma.TransactionGroupByArgs, 'by' | 'where'>,
  ): Promise<Array<Prisma.TransactionGroupByOutputType>> {
    const args: Prisma.TransactionGroupByArgs = {
      by,
      where,
      orderBy: undefined, // Required by Prisma type but optional in practice
    };
    if (aggregate) {
      Object.assign(args, aggregate);
    }
    // Type assertion needed: Prisma's groupBy has complex conditional types
    // that TypeScript cannot infer correctly when aggregate is optional
    // @ts-expect-error - Prisma's groupBy type inference is complex and doesn't handle optional aggregate correctly
    return this.prisma.transaction.groupBy(args) as Promise<Array<Prisma.TransactionGroupByOutputType>>;
  }

  /**
   * Calculate income and expense totals using database-level aggregation
   * Uses SQL CASE statement for efficient calculation without fetching all transactions
   * @param where - Where clause for filtering
   * @returns Object with totalIncome and totalExpense
   */
  async calculateIncomeExpenseTotals(
    where: Prisma.TransactionWhereInput,
  ): Promise<{totalIncome: number; totalExpense: number}> {
    // Use Prisma's SQL template for safe query construction
    // Build WHERE conditions using Prisma.sql
    const whereParts: PrismaNamespace.Sql[] = [];

    // Note: Transactions don't have direct workspaceId, filter via account.workspaceId
    // This method is used for aggregation, workspace filtering should be done via accountId

    if ('accountId' in where && where.accountId) {
      if (typeof where.accountId === 'object' && 'in' in where.accountId && Array.isArray(where.accountId.in)) {
        whereParts.push(PrismaNamespace.sql`t."accountId" = ANY(${where.accountId.in})`);
      } else if (typeof where.accountId === 'string') {
        whereParts.push(PrismaNamespace.sql`t."accountId" = ${where.accountId}`);
      }
    }

    if ('categoryId' in where && where.categoryId) {
      if (typeof where.categoryId === 'object' && 'in' in where.categoryId && Array.isArray(where.categoryId.in)) {
        whereParts.push(PrismaNamespace.sql`t."categoryId" = ANY(${where.categoryId.in})`);
      } else if (typeof where.categoryId === 'string') {
        whereParts.push(PrismaNamespace.sql`t."categoryId" = ${where.categoryId}`);
      }
    }

    if ('payeeId' in where && where.payeeId) {
      if (typeof where.payeeId === 'object' && 'in' in where.payeeId && Array.isArray(where.payeeId.in)) {
        whereParts.push(PrismaNamespace.sql`t."payeeId" = ANY(${where.payeeId.in})`);
      } else if (typeof where.payeeId === 'string') {
        whereParts.push(PrismaNamespace.sql`t."payeeId" = ${where.payeeId}`);
      }
    }

    if ('date' in where && where.date && typeof where.date === 'object') {
      if ('gte' in where.date && where.date.gte) {
        whereParts.push(PrismaNamespace.sql`t."date" >= ${where.date.gte}`);
      }
      if ('lte' in where.date && where.date.lte) {
        whereParts.push(PrismaNamespace.sql`t."date" <= ${where.date.lte}`);
      }
    }

    if ('note' in where && where.note && typeof where.note === 'object' && 'contains' in where.note && where.note.contains) {
      const noteContainsValue = where.note.contains;
      if (typeof noteContainsValue === 'string') {
        whereParts.push(PrismaNamespace.sql`t."note" ILIKE ${`%${noteContainsValue}%`}`);
      }
    }

    // Build WHERE clause by combining parts with AND
    let whereClause = PrismaNamespace.empty;
    if (whereParts.length > 0) {
      // Combine all WHERE parts with AND
      let combined = whereParts[0];
      for (let i = 1; i < whereParts.length; i++) {
        combined = PrismaNamespace.sql`${combined} AND ${whereParts[i]}`;
      }
      whereClause = PrismaNamespace.sql`WHERE ${combined}`;
    }

    // Use raw SQL with CASE statement for efficient aggregation
    // Income: sum of absolute values where category type is Income
    // Expense: sum of absolute values where category type is Expense or NULL
    const query = PrismaNamespace.sql`
      SELECT
        COALESCE(SUM(CASE WHEN c."categoryType" = 'Income' THEN ABS(t.value) ELSE 0 END), 0) as "totalIncome",
        COALESCE(SUM(CASE WHEN c."categoryType" = 'Expense' OR c."categoryType" IS NULL THEN ABS(t.value) ELSE 0 END), 0) as "totalExpense"
      FROM "Transaction" t
      LEFT JOIN "Category" c ON t."categoryId" = c.id
      ${whereClause}
    `;

    const result = await this.prisma.$queryRaw<Array<{totalIncome: bigint; totalExpense: bigint}>>(query);

    const row = result[0];
    if (!row) {
      return {totalIncome: 0, totalExpense: 0};
    }

    return {
      totalIncome: Number(row.totalIncome),
      totalExpense: Number(row.totalExpense),
    };
  }
}
